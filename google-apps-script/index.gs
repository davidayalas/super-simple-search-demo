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
  Browser.msgBox("Índex sincronitzat!");
}

function forceInvalidation(){
  const options = {
    'method' : 'post',
    'headers' : {
      'x-api-key' : apikey,
      'x-invalidatepaths': '/search*'
    }
  };

  const endpoint = `https://${dns}/invalidate/`;
  UrlFetchApp.fetch(endpoint, options);
}