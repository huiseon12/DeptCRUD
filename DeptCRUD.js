/*
+--------+------------+----------+
| DEPTNO | DNAME      | LOC      |
+--------+------------+----------+
|     10 | ACCOUNTING | NEW YORK |
|     20 | RESEARCH   | DALLAS   |
|     30 | SALES      | CHICAGO  |
|     40 | OPERATIONS | BOSTON   |
+--------+------------+----------+
*/
const http=require("http");
const url=require("url");
const querystring=require("querystring");
const fs=require("fs/promises");
const mysql=require("mysql2");
const pug=require("pug");
const {renderFile} = require("pug");
// const buffer = require("buffer");
const server=http.createServer(); //서버가 만들어짐
server.listen(8888,()=>{
    console.log("http://localhost:8888 DEPT CRUD 서버")
});
const mysqlConInfo={
    host:"localhost",
    port:3306,
    user:"root",
    password:"mysql123",
    database:"scott"
}
const creatPool=mysql.createPool(mysqlConInfo);
const pool=creatPool.promise();

server.on("request",async (req, res)=>{
    const urlObj=url.parse(req.url);
    const params=querystring.parse(urlObj.query);
    const urlSplits=urlObj.pathname.split("/");
    if (urlSplits[1]==="public"){ //정적리소스
        if (urlSplits[2]==="js"){
            res.setHeader("content-type","application/javascript");
        }else if (urlSplits[2]==="css"){
            res.setHeader("content-type","text/css");
        }else if (urlSplits[2]==="image"){
            res.setHeader("content-type","image/jpeg");
        }
        try{
            let data=await fs.readFile("."+urlObj.pathname)
            res.write(data);
            res.end();
        }catch (e) { //잘못된 주소
            res.statusCode=404;
            res.end();
        }
    }else {
        if(urlObj.pathname==="/"){ //첫화면
            let html=pug.renderFile("./templates2/index.pug");
            res.write(html);
            res.end();
        }else if(urlObj.pathname==="/deptList.do"){ //부서리스트 출력화면
            try{
                const [rows,fields]=await pool.query("SELECT * FROM DEPT");
                let html=pug.renderFile("./templates2/deptList.pug",{deptList:rows})
                res.write(html);
                res.end();
            }catch (e) {
                console.error(e);
            }
        }else if(urlObj.pathname==="/deptDetail.do"){ //부서 정보
            let deptno=Number(params.deptno);
            if(Number.isNaN(deptno)){ //400에러
                res.statusCode=400;
                res.write("<h1>해당 페이지에 필요한 파라미터를 보내지 않았습니다. 400</h1>");
                res.end();
                return;
            }
            let sql="SELECT * FROM DEPT WHERE DEPTNO=?";
            const [rows,f]=await pool.query(sql,[deptno]);
            let html=pug.renderFile("./templates2/deptDetail.pug",{dept:rows[0]})
            res.write(html);
            res.end();
        }else if(urlObj.pathname==="/deptUpdate.do"&&req.method==="GET"){ //부서 수정
            let deptno=Number(params.deptno);
            if(Number.isNaN(deptno)){ //400에러
                res.statusCode=400;
                res.write("<h1>해당 페이지에 필요한 파라미터를 보내지 않았습니다. 400</h1>");
                res.end();
                return;
            }
            let sql="SELECT * FROM DEPT WHERE DEPTNO=?";
            const [rows,fields]=await pool.query(sql,[deptno]);
            if(rows.length===0){ //조회된 부서가 없을 때
                res.writeHead("302",{location:"/deptList.do"});
                res.end();return;
            }
            let html=pug.renderFile("./templates2/deptUpdate.pug",{dept:rows[0]})
            res.write(html);
            res.end();
        }else if(urlObj.pathname==="/deptUpdate.do"&&req.method==="POST") { //부서수정 엑션
            let postQuery = "";
            let update = 0;
            req.on("data", (param) => {
                postQuery += param;
            });
            req.on("end", async() => {
                const postPs = querystring.parse(postQuery);
                try {
                    let sql="UPDATE DEPT SET DNAME=?,LOC=? WHERE DEPTNO=?";
                    const [result]=await pool.execute(sql,[postPs.dname, postPs.loc, postPs.deptno]);
                    console.log(result);
                    update = result.affectedRows;
                } catch (e) {
                    console.error(e);
                }
                if (update > 0) { //성공시 상세페이지로
                    res.writeHead(302, {location: "/deptList.do?deptno=" + postPs.deptno});
                    res.end();
                } else { //실패시 수정페이지로
                    res.writeHead(302, {location: "/deptUpdate.do?deptno=" + postPs.deptno});
                    res.end();
                }
            });
        }else if(urlObj.pathname==="/deptInsert.do"&&req.method==="GET"){ //등록
            let html=pug.renderFile("./templates2/deptInsert.pug");
            res.write(html);
            res.end();
        }else if(urlObj.pathname==="/deptInsert.do"&&req.method==="POST"){ //등록엑션
            let postQuery="";
            req.on("data",(p)=>{postQuery+=p;});
            req.on("end",async ()=>{
                const postPs=querystring.parse(postQuery);
                for(let key in postPs){
                    if(postPs[key].trim()==="")postPs[key]=null;
                }
                let sql=`INSERT INTO DEPT (DEPTNO, DNAME, LOC) VALUE (?,?,?)`;
                let insert=0;
                try{
                    const [result]=await pool.execute(sql,[postPs.deptno,postPs.dname,postPs.loc]);
                    insert=result.affectedRows;
                }catch (e) {
                    console.error(e);
                }
                if(insert>0){ //성공시 리스트로
                    res.writeHead(302,{location:"/deptList.do"});
                    res.end();
                }else{ //실패시 등록으로
                    res.writeHead(302,{location:"/deptInsert.do"});
                    res.end();
                }
            });
        }else if(urlObj.pathname==="/deptDelete.do"){ //삭제 엑션 페이지
            let deptno=Number(params.deptno);
            if(Number.isNaN(deptno)){
                res.statusCode=400;
                res.write("<h1>해당 페이지에 필요한 파라미터를 보내지 않았습니다. 400</h1>");
                res.end();
                return;
            }
            let sql="DELETE FROM DEPT WHERE DEPTNO=?";
            let del=0;
            try{
                const [result]=await pool.execute(sql,[deptno]);
                del=result.affectedRows;
            }catch (e) {
                console.error(e);
            }
            if(del>0){
                res.writeHead(302,{location:"/deptList.do"});
                res.end();
            }else{
                res.writeHead(302,{location:"/deptUpdate.do?deptno="+params.deptno});
                res.end();
            }
        }else{ //404 에러
            res.statusCode=404;
            res.setHeader("content-type","text/html;charset=UTF-8");
            res.write("<h1>존재하지 않는 페이지 입니다. 404</h1>");
            res.end();
        }
    }
});
