const scriptProperties = PropertiesService.getScriptProperties();

const apikey = scriptProperties.getProperty("x-api-key");
const key = scriptProperties.getProperty("KEY");
const secret = scriptProperties.getProperty("SECRET");
const dns = scriptProperties.getProperty("domain");
const bucket = scriptProperties.getProperty("bucket");
const indexFile = scriptProperties.getProperty("file");

const indexSheet = "index";

const ss = SpreadsheetApp.getActiveSpreadsheet();
const permissions = ss.getSheetByName(indexSheet);

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  ui.createMenu('Simple Search')
      .addItem('Sincronitzar índex', "s3uploadIndex")
      .addToUi();
}

function getCSVData(_sheet){

  const range = _sheet.getDataRange();
  const values = range.getValues();
  let rows = [];
  let row;
  let fullText;
  for (var i = 0; i < values.length; i++) {
    row = "";
    fullText = "";
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j]) {
        row = row + '"' + values[i][j] + '"';
        fullText = fullText + " " + (values[i][j] ? (values[i][j]+"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "");
      }
      row = row + ",";
    }
    row = row  + '"' + (i>0 ? fullText.toLowerCase() : "fullText") + '"';
    rows.push(row);
  }
  return rows;
}

function s3uploadIndex(){
  const s3 = S3.getInstance(key, secret);
  const blob = Utilities.newBlob(getCSVData(permissions).join("\n", "text/csv"));
  s3.putObject(bucket, indexFile, blob, {logRequests:true});
  forceInvalidation();
  Browser.msgBox("Sync!");
}

function forceInvalidation(){
  const options = {
    'method' : 'post',
    'headers' : {
      'x-api-key' : apikey,
      'x-invalidatepaths': '/search*'
    },
    'muteHttpExceptions' : true
  };

  const endpoint = `https://${dns}/invalidate/`;
  UrlFetchApp.fetch(endpoint, options);
}


/*
 * very basic AWS S3 Client library for Google Apps Script
 * @author Erik Schultink <erik@engetc.com>
 * includes create/delete buckets, create/read/delete objects. very limited support for any optional params.
 * 
 * @see http://engetc.com/projects/amazon-s3-api-binding-for-google-apps-script/
 */

/**
 * @license Copyright 2014-15 Eng Etc LLC - All Rights Reserved
 *
 * LICENSE (Modified BSD) - Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 *   1) Redistributions of source code must retain the above copyright notice, this list of conditions and 
 *      the following disclaimer.
 *   2) Redistributions in binary form must reproduce the above copyright notice, this list of conditions 
 *      and the following disclaimer in the documentation and/or other materials provided with the 
 *      distribution.
 *   3) Neither the name of the Eng Etc LLC, S3-for-Google-Apps-Script, nor the names of its contributors may be used to endorse or 
 *      promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED 
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A 
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL ENG ETC LLC BE LIABLE FOR ANY DIRECT, INDIRECT, 
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR 
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF 
 * SUCH DAMAGE.
 */

//Body of the library


/* constructs an S3 service
 *
 * @constructor
 * @param {string} accessKeyId your AWS AccessKeyId
 * @param {string} secretAccessKey your AWS SecretAccessKey
 * @param {Object} options key-value object of options, unused
 *
 * @return {S3}
 */
function getInstance(accessKeyId, secretAccessKey, options) {
  return new S3(accessKeyId, secretAccessKey, options);
}

/* constructs an S3 service
 *
 * @constructor
 * @param {string} accessKeyId your AWS AccessKeyId
 * @param {string} secretAccessKey your AWS SecretAccessKey
 * @param {Object} options key-value object of options, unused
 */
function S3(accessKeyId, secretAccessKey, options) {
  if (typeof accessKeyId !== 'string') throw "Must pass accessKeyId to S3 constructor";
  if (typeof secretAccessKey !== 'string') throw "Must pass secretAcessKey to S3 constructor";
  
  this.accessKeyId = accessKeyId;
  this.secretAccessKey = secretAccessKey;
  this.options = options | {};
}



/* creates bucket in S3
 *
 * @param {string} bucket name of bucket
 * @param {Object} options optional parameters to create request; supports x-amz-acl
 * @throws {Object} AwsError on failure
 * @return void
 */
S3.prototype.createBucket = function (bucket, options) {
  options = options || {}; 
  
  
  var request = new S3Request(this);
  request.setHttpMethod('PUT');
  
  //this is dumb and is optional from AWS perspective
  //but UrlFetchApp will default a Content-Type header to application/xml-www-form-url-encoded or whatever, which 
  //screws up the signature of the request
  request.setContentType('text/plain');
  
  //support setting of ACL
  if (typeof options["x-amz-acl"] == 'undefined') {
    options["x-amz-acl"] = "private";
  }
  request.addHeader("x-amz-acl", options["x-amz-acl"]);
  
  request.setBucket(bucket);
  
  request.execute(options);
  
};

/* deletes bucket from S3 
 *
 * @param {string} bucket name of bucket
 * @param {Object} options optional parameters to delete request
 * @throws {Object} AwsError on failure
 * @return void
 */
S3.prototype.deleteBucket = function (bucket, options) {
  options = options || {};

  var request = new S3Request(this);
  request.setHttpMethod('DELETE');
  
  request.setBucket(bucket);
  request.execute(options);
};

/* puts an object into S3 bucket
 * 
 * @param {string} bucket 
 * @param {string} objectName name to uniquely identify object within bucket
 * @param {string} object byte sequence that is object's content
 * @param {Object} options optional parameters
 * @throws {Object} AwsError on failure
 * @return void
 */
S3.prototype.putObject = function (bucket, objectName, object, options) {
  options = options || {};

  var request = new S3Request(this);
  request.setHttpMethod('PUT');
  request.setBucket(bucket);
  request.setObjectName(objectName);
  
  var failedBlobDuckTest = !(typeof object.copyBlob == 'function' &&
                      typeof object.getDataAsString == 'function' &&
                      typeof object.getContentType == 'function'
                      );
  
  //wrap object in a Blob if it doesn't appear to be one
  if (failedBlobDuckTest) {
    object = Utilities.newBlob(JSON.stringify(object), "application/json");
    object.setName(objectName);
  }
  
  request.setContent(object.getDataAsString());
  request.setContentType(object.getContentType());
  
  request.execute(options);  
};

/* gets object from S3 bucket
 *
 * @param {string} bucket name of bucket
 * @param {string} objectName name that uniquely identifies object within bucket
 * @param {Object} options optional parameters for get request (unused)
 * @throws {Object} AwsError on failure
 * @return {Blob|Object} data value, converted from JSON or as a Blob if it was something else; null if it doesn't exist
 */
S3.prototype.getObject = function (bucket, objectName, options) {
  options = options || {};
  
  var request = new S3Request(this);
  request.setHttpMethod('GET');
  
  request.setBucket(bucket);
  request.setObjectName(objectName);
  try {
    var responseBlob = request.execute(options).getBlob();
  } catch (e) {
    if (e.name == "AwsError" && e.code == 'NoSuchKey') {
      return null;
    } else {
      //some other type of error, rethrow
      throw e; 
    }
  }
  
  //not sure this is better to put here, rather than in S3Request class
  if (responseBlob.getContentType() == "application/json") {
     return JSON.parse(responseBlob.getDataAsString());
  }
  return responseBlob;
};

/* deletes object from S3 bucket
 *
 * @param {string} bucket bucket name
 * @param {string} objectName name that uniquely identifies object within bucket
 * @param {Object} options optional parameters to delete request, unused
 * @throws {Object} AwsError on failure
 * @return void
 */
S3.prototype.deleteObject = function (bucket, objectName, options) {
  options = options || {};  
  
  var request = new S3Request(this);
  request.setHttpMethod('DELETE');
  
  request.setBucket(bucket);
  request.setObjectName(objectName);
  
  request.execute(options);  
};


//for debugging
S3.prototype.getLastExchangeLog = function() {
  return this.lastExchangeLog; 
}

/*
 * helper to format log entry about HTTP request/response
 * 
 * @param {Object} request object, from UrlFetchApp.getRequest()
 * @param {goog.HTTPResponse} response object, from UrlFetchApp
 */
S3.prototype.logExchange_ = function(request, response) {
  var logContent = "";
  logContent += "\n-- REQUEST --\n";
  for (i in request) {
    if (typeof request[i] == 'string' && request[i].length > 1000) {
      //truncate to avoid making log unreadable
      request[i] = request[i].slice(0, 1000) + " ... [TRUNCATED]"; 
    }
    logContent += Utilities.formatString("\t%s: %s\n", i, request[i]);
  }
    
  logContent += "-- RESPONSE --\n";
  logContent += "HTTP Status Code: " + response.getResponseCode() + "\n";
  logContent += "Headers:\n";
  
  var headers = response.getHeaders();
  for (i in headers) {
    logContent += Utilities.formatString("\t%s: %s\n", i, headers[i]);
  }
  logContent += "Body:\n" + response.getContentText();
  this.lastExchangeLog = logContent;
}


/* constructs an S3Request to an S3 service
 *
 * @constructor
 * @param {S3} service S3 service to which this request will be sent
 */
function S3Request(service) {
  this.service = service;

  this.httpMethod = "GET";
  this.contentType = "";
  this.content = ""; //content of the HTTP request
  this.bucket = ""; //gets turned into host (bucketName.s3.amazonaws.com)
  this.objectName = "";
  this.headers = {};
  
  this.date = new Date();
}

/* sets contenetType of the request
 * @param {string} contentType mime-type, based on RFC, indicated how content is encoded
 * @throws {string} message if invalid input
 * @return {S3Request} this request, for chaining
 */
S3Request.prototype.setContentType = function (contentType) {
  if (typeof contentType != 'string') throw 'contentType must be passed as a string';
  this.contentType = contentType;
  return this;
};

S3Request.prototype.getContentType = function () {
  if (this.contentType) {
    return this.contentType; 
  } else {
    //if no contentType has been explicitly set, default based on HTTP methods
    if (this.httpMethod == "PUT" || this.httpMethod == "POST") {
      //UrlFetchApp defaults to this for these HTTP methods
      return "application/x-www-form-urlencoded"; 
    }
  }
  return "";
}


/* sets content of request
 * @param {string} content request content encoded as a string
 * @throws {string} message if invalid input
 * @return {S3Request} this request, for chaining
 */ 
S3Request.prototype.setContent = function(content) {
  if (typeof content != 'string') throw 'content must be passed as a string'
  this.content = content; 
  return this;
};

/* sets Http method for request
 * @param {string} method http method for request
 * @throws {string} message if invalid input
 * @return {S3Request} this request, for chaining
 */
S3Request.prototype.setHttpMethod = function(method) {
  if (typeof method != 'string') throw "http method must be string";
  this.httpMethod = method; 
  return this;
};

/* sets bucket name for the request
 * @param {string} bucket name of bucket on which request operates
 * @throws {string} message if invalid input
 * @return {S3Request} this request, for chaining
 */
S3Request.prototype.setBucket = function(bucket) {
  if (typeof bucket != 'string') throw "bucket name must be string";
  this.bucket = bucket;
  return this;
};
/* sets objectName (key) for request
 * @param {string} objectName name that uniquely identifies object within bucket
 * @throws {string} message if invalid input
 * @return {S3Request} this request, for chaining
 */
S3Request.prototype.setObjectName = function(objectName) {
  if (typeof objectName != 'string') throw "objectName must be string";
  this.objectName = objectName; 
  return this;
};


/* adds HTTP header to S3 request (see AWS S3 REST api documentation for possible values)
 * 
 * @param {string} name Header name
 * @param {string} value Header value
 * @throws {string} message if invalid input
 * @return {S3Request} this object, for chaining
 */
S3Request.prototype.addHeader = function(name, value) {
  if (typeof name != 'string') throw "header name must be string";
  if (typeof value != 'string') throw "header value must be string";
  this.headers[name] = value; 
  return this;
};

/* gets Url for S3 request 
 * @return {string} url to which request will be sent
 */
S3Request.prototype.getUrl = function() {
  return "http://" + this.bucket.toLowerCase() + ".s3.amazonaws.com/" + this.objectName;
};
/* executes the S3 request and returns HttpResponse
 *
 * Supported options:
 *   logRequests - log requests (and responses) will be logged to Apps Script's Logger. default false.
 *   echoRequestToUrl - also send the request to this URL (useful for debugging Apps Script weirdness)   
 *
 * @param {Object} options object with properties corresponding to option values; see documentation
 * @throws {Object} AwsError on failure
 * @returns {goog.UrlFetchApp.HttpResponse} 
 */
S3Request.prototype.execute = function(options) {
  options = options || {};
  
  this.headers.Authorization = this.getAuthHeader_();
  this.headers.Date = this.date.toUTCString();
  if (this.content.length > 0) {
    this.headers["Content-MD5"] = this.getContentMd5_();
  }
  
  var params = {
    method: this.httpMethod,
    payload: this.content,
    headers: this.headers,
    muteHttpExceptions: true //get error content in the response
  }

  //only add a ContentType header if non-empty (although should be OK either way)
  if (this.getContentType()) {
    params.contentType = this.getContentType();
  }
  
  var response = UrlFetchApp.fetch(this.getUrl(), params);


  
  //debugging stuff
  var request = UrlFetchApp.getRequest(this.getUrl(), params);  


  //Log request and response
  this.lastExchangeLog = this.service.logExchange_(request, response);
  if (options.logRequests) {
    Logger.log(this.service.getLastExchangeLog());
  }
  
  //used in case you want to peak at the actual raw HTTP request coming out of Google's UrlFetchApp infrastructure
  if (options.echoRequestToUrl) {
    UrlFetchApp.fetch(options.echoRequestToUrl, params); 
  }
  
  //check for error codes (AWS uses variants of 200s for flavors of success)
  if (response.getResponseCode() > 299) {
    //convert XML error response from AWS into JS object, and give it a name
    var error = {};
    error.name = "AwsError";
    try {
      var errorXmlElements = XmlService.parse(response.getContentText()).getRootElement().getChildren();
    
      for (i in errorXmlElements) {
        var name = errorXmlElements[i].getName(); 
        name = name.charAt(0).toLowerCase() + name.slice(1);
        error[name] = errorXmlElements[i].getText();
      }
      error.toString = function() { return "AWS Error - "+this.code+": "+this.message; }; 
     
      error.httpRequestLog = this.service.getLastExchangeLog();
    } catch (e) {
      //error parsing XML error response from AWS (will obscure actual error)
 
      error.message = "AWS returned HTTP code " + response.getResponseCode() + ", but error content could not be parsed."
      
      error.toString = function () { return this.message; };
      
      error.httpRequestLog = this.service.getLastExchangeLog();
    }
    
    throw error;
  }
  
  return response;
};


/* computes Authorization Header value for S3 request
 * reference http://docs.aws.amazon.com/AmazonS3/latest/dev/RESTAuthentication.html
 *
 * @private
 * @return {string} base64 encoded HMAC-SHA1 signature of request (see AWS Rest auth docs for details)
 */
S3Request.prototype.getAuthHeader_ = function () {
    
//  StringToSign = HTTP-VERB + "\n" +
//    Content-MD5 + "\n" +
//    Content-Type + "\n" +
//    Date + "\n" +
//    CanonicalizedAmzHeaders +
//    CanonicalizedResource;    
  var stringToSign = this.httpMethod + "\n";
  
  var contentLength = this.content.length;
  stringToSign += this.getContentMd5_() + "\n" ;
  stringToSign += this.getContentType() + "\n";

  
  //set expires time 60 seconds into future
  stringToSign += this.date.toUTCString() + "\n";


  // Construct Canonicalized Amazon Headers
  //http://docs.aws.amazon.com/AmazonS3/latest/dev/RESTAuthentication.html#RESTAuthenticationRequestCanonicalization
  var amzHeaders = [];
  
  for (var headerName in this.headers) {
    // only AMZ headers
    // convert to lower case (1)
    // multi-line headers to single line (4)
    // one space after : (5)
    if (headerName.match(/^x-amz/i)) {
      var header = headerName.toLowerCase() + ":" + this.headers[headerName].replace(/\s+/, " ");
      amzHeaders.push(header) 
    }
  }
  // (3) is just that multiple values of the same header must be passed as CSV, rather than listed multiple times; implicit
  // sort lexographically (2), and combine into string w single \n separating each (6)
  if (amzHeaders.length > 0) {
    stringToSign += amzHeaders.sort().join("\n") + "\n";
  }
  
  var canonicalizedResource = "/" + this.bucket.toLowerCase() + this.getUrl().replace("http://"+this.bucket.toLowerCase()+".s3.amazonaws.com","");
  stringToSign += canonicalizedResource;
  
//  Logger.log("-- string to sign --\n"+stringToSign);
  
  //Signature = Base64( HMAC-SHA1( YourSecretAccessKeyID, UTF-8-Encoding-Of( StringToSign ) ) );  
  var signature = Utilities.base64Encode(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, 
                                                                        stringToSign, 
                                                                        this.service.secretAccessKey, 
                                                                        Utilities.Charset.UTF_8));
      
  return "AWS " + this.service.accessKeyId + ':' + signature; 
};

/* calculates Md5 for the content (http request body) of the S3 request
 *   (Content-MD5 on S3 is recommended, not required; so can change this to return "" if it's causing problems - likely due to charset mismatches)
 * 
 * @private
 * @return {string} base64 encoded MD5 hash of content
 */
S3Request.prototype.getContentMd5_ = function() {
  if (this.content.length > 0) {
    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, this.content, Utilities.Charset.UTF_8));
  } else {
    return ""; 
  }
};
