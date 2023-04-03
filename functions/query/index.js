'use strict';

const s3select = require("./s3select");
const utils = require("../utils");

exports.handler = async (event, context, callback) => {
    
    const [customHeaders] = utils.getHeaderObjects(event);
    
    const index = utils.getHeader(customHeaders, "index");
    const bucket = utils.getHeader(customHeaders, "bucket");
   
    const uri = event.Records[0].cf.request.uri;
    
    let search = uri.replace("/search/","");
    
    const searchSetup = search.split("/");
    search = searchSetup.slice(1);
    let SQL;
    
    switch(searchSetup[0]){
        case "fulltext":
           SQL = `select * from s3object where fulltext like '%${search.join(" ")}%'`;
           break;
        case "params":
           let params = [];
           for(let i=0,z=search.length;i<z;i++){
               params.push(search[i] + " = '" + (z>i+1?decodeURIComponent(search[i+1]):'') + "'");
               i++;
           }
           SQL = `select * from s3object where ${params.join(' and ')}`;
           break;
        
    }
    
    let response = {
        status: '200',
        body: "[]",
        bodyEncoding: 'text',
        headers: {
            'content-type': [{
                key: 'Content-Type',
                value: 'application/json'
            }],
            'access-control-allow-origin': [{
                key: 'Access-Control-Allow-Origin',
                value: '*'
            }],
            'access-control-allow-credentials': [{
                key: 'Access-Control-Allow-Credentials',
                value: 'true'
            }]
        }        
    };
    
    if(search===""){
        callback(null, response);
        return;
    }

    try{
        response.body = await s3select.query({
            "Bucket" : bucket,
            "Key": index, 
            "Expression": SQL
        });
    }catch(e){
        console.log(e);
    }      

    callback(null, response);
    
};