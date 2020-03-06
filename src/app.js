//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX//
// Load Content
//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX//
var http = require("http");
var xml2js = require("xml2js"); // easy convert XML 2 JS format
var request = require("request"); // require HTTP requests
const fs = require("fs"); // require filesystem
var logger = require("./logger"); // this is a CSV logger
var d = new Date();
var date = d.toISOString().split(".")[0]; // set proper date
var csv = `../logs/results-${date.replace(/:/g,"")}.csv`; 
var logfile = `../logs/log-${date.replace(/:/g,"")}.log`;
var examplefile = `./examples/`;
var parseString = xml2js.parseString;
////////////////////////////////////
//         Start Edit Here        //
////////////////////////////////////
var pageSize = 250; // Allowed page sizes: 25, 50, 100, 200, 250. Default value: 50 if nothing is set.
var authCreds = {
    "authRequest": {
      "maaS360AdminAuth": {
        "billingID": {{billingID}},
        "platformID": {{platformID}},
        "appID":"{{appID}}",
        "appVersion":"{{version}}",
        "appAccessKey":"{{appAccessKey}}",
        "userName":"{{username}}",
        "password":"{{password}}"
        }
    }
};
var groupName = "MaaS360_Enabled_Users";
////////////////////////////////////
//         Stop Edit Here         //
////////////////////////////////////

logger.log(logfile, "-- Starting Script --");
logger.log(logfile, `Status File Location: ${csv}`);
logger.log(logfile, `Log File Location: ${logfile}`);
// Set Headers
logger.csv(csv, `User,Device ID,Mailbox ID,Current Status,Action Status`);

var pageSizeFormatted = `pageSize=${pageSize}`;
var authToken;
var urlList = {
    "authUrl" : `https://services.m3.maas360.com/auth-apis/auth/1.0/authenticate/${authCreds.authRequest.maaS360AdminAuth.billingID}`,
    "blockUrl": `https://services.m3.maas360.com/device-apis/devices/1.0/blockDeviceMessagingSystem/${authCreds.authRequest.maaS360AdminAuth.billingID}?deviceId=`,
    "getGroups": `https://services.m3.maas360.com/group-apis/group/1.0/groups/customer/${authCreds.authRequest.maaS360AdminAuth.billingID}`,
    "getUsers": `https://services.m3.maas360.com/user-apis/user/1.0/searchByGroup/customer/${authCreds.authRequest.maaS360AdminAuth.billingID}/groupIdentifier/`,
    "getDevices": `https://services.m3.maas360.com/device-apis/devices/2.0/search/customer/${authCreds.authRequest.maaS360AdminAuth.billingID}?deviceStatus=Active&email=`,
    "getStatus": `https://services.m3.maas360.com/device-apis/devices/1.0/summary/${authCreds.authRequest.maaS360AdminAuth.billingID}?deviceId=`
}

function auth(creds,url){
    logger.log(logfile, `Starting Authentication to MaaS360`);
    logger.log(logfile, `URL for Authentication is: ${url}`);
    return new Promise((resolve, reject) => {
         request({
            url: url,
            method: "POST",
            headers: {
              "Content-Type":"application/json"
                  },
            body: JSON.stringify(authCreds)
          }, function (error, response, body) {
            if(error) {
              //handle error
                logger.log(logfile,`[ERROR] Authentication Failed: ${response.statusCode}`);
            } else if(!error && response.statusCode == 200){
                parseString(body, function (err, result) {
                    logger.log(logfile,`Response from MaaS360 API: ${response.statusCode}`);
                    logger.log(logfile,`Authentication Successful to MaaS360 API`);
                    resolve(result.authResponse.authToken);
                });
            }
          });
    });
}

function getGroups(token, url) {
    return new Promise((resolve, reject) => {
         request({
            url: url,
            method: "GET",
            headers: {
              "Content-Type":"application/x-www-form-urlencode",
              "Authorization":`MaaS token="${token}"`
                  }
          }, function (error, response, body) {
            if(error) {
              //handle error
              logger.log(logfile, `[Error] ${error}: ${response.statusCode}`);
            } else if(!error && response.statusCode == 200){
                parseString(body, function (err, result) {
                    //authToken = result.authResponse.authToken;
                    logger.log(logfile, `Performed call to get all groups in existence`);
                    resolve(result.groups);
                });
            }
          });
    });
}
function getUsers(token, url, id, pageNumber) {
    pageNumber = (typeof pageNumber !== 'undefined') ?  pageNumber : 1;
    logger.log(logfile, `Processing all users from page ${pageNumber} from the API of users`);
    return new Promise((resolve,reject) => {
        request({
            url: `${url}${id}?${pageSizeFormatted}&${pageNumber}`,
            method: "GET",
            headers: {
              "Content-Type":"application/x-www-form-urlencode",
              "Authorization":`MaaS token="${token}"`
                  }
          }, function (error, response, body) {
            if(error) {
              //handle error
              logger.log(logfile, `[Error] ${error}: ${response.statusCode}`);
            } else if(!error && response.statusCode == 200){
                parseString(body, function (err, result) {
                    logger.log(logfile, `Performed call to get all users within group ${groupName}`);
                    resolve(result);
                });
            }
          });
    });
}
function setUserProperty(devices, count){
    if(count == 1){
        return(devices.devices.device.emailAddress.toString());
    }else{
        return(devices.devices.device[0].emailAddress.toString());
    }
}
function processUsers(token, userList) {

    if(userList) {
        var length = userList.users.count.toString();
    }

    for(var i = 0; i < length; i++)
    {
        var j = i;
        var uName = userList.users.user[j].emailAddress.toString();
        getUserDevices(token, urlList.getDevices, uName)
        .then((devices) => {
            var count = devices.devices.count.toString();
            var email = setUserProperty(devices, count);
            logger.log(logfile, `[${email}] This user has ${count} devices.`);
            evalDevices(token, devices, count, email);
        });
    }
}
function setDeviceProperties(deviceList, count, j){
    if(count == 1)
        {
            var deviceInfo = {
            "mainMailboxMdmxx": deviceList.devices.device.mailboxDeviceId.startsWith("mdmxx"), // true/false
            "secMailboxMdmxx": deviceList.devices.device.mdmMailboxDeviceId.startsWith("mdmxx"), //true/false
            "mainMailboxLength": deviceList.devices.device.mailboxDeviceId.length, // 0 or >1
            "secMailboxLength": deviceList.devices.device.mdmMailboxDeviceId.length, // 0 or >1
            "mainMailboxId": deviceList.devices.device.mailboxDeviceId,
            "secMailboxId": deviceList.devices.device.mdmMailboxDeviceId,
            "ownership": deviceList.devices.device.ownership.startsWith("Corporate"),
            "maas360DeviceID" : deviceList.devices.device.maas360DeviceID
            };
        }
    else
        {
            var deviceInfo = {
            "mainMailboxMdmxx": deviceList.devices.device[j].mailboxDeviceId.startsWith("mdmxx"),
            "secMailboxMdmxx": deviceList.devices.device[j].mdmMailboxDeviceId.startsWith("mdmxx"),
            "mainMailboxLength": deviceList.devices.device[j].mailboxDeviceId.length,
            "secMailboxLength": deviceList.devices.device[j].mdmMailboxDeviceId.length,
            "mainMailboxId": deviceList.devices.device[j].mailboxDeviceId,
            "secMailboxId": deviceList.devices.device[j].mdmMailboxDeviceId,
            "ownership": deviceList.devices.device[j].ownership.startsWith("Corporate"),
            "maas360DeviceID" : deviceList.devices.device[j].maas360DeviceID
            };
        }
        return (deviceInfo);
}
function processDevice(token, deviceInfo, email){
    return new Promise((resolve, reject) => {
        var list = [];
        var mid = deviceInfo.maas360DeviceID;

        var multipleDevices = (deviceInfo.mainMailboxLength > 0 && deviceInfo.secMailboxLength > 0 && !(deviceInfo.mainMailboxId === deviceInfo.secMailboxId));
        logger.log(logfile, `[${email}] Check if Device ID: ${mid} has multiple Devices: ${multipleDevices}`);

        if (multipleDevices) {
            logger.log(logfile, `[${email}] Device ID: ${mid} processing both mailbox IDs`);
            if(!deviceInfo.ownership){ // if not corporate owned, then continue
                var mailboxGroup = [deviceInfo.mainMailboxId,deviceInfo.secMailboxId]; // put both into array
                var mailboxType = [deviceInfo.mainMailboxMdmxx,deviceInfo.secMailboxMdmxx]; // put both types of mailboxes into array
                for(var w = 0; w < 2; w++){ // process both in a foreach loop function
                    var ww = w;
                    (function() {
                        if(!mailboxType[ww]) { // if secure mail, then skip
                            list.push(mailboxGroup[ww]);
                            getStatus(token, urlList.getStatus, mailboxGroup[ww])
                            .then((r) => {
                                logger.log(logfile, `[${email}] Device ID: ${mailboxGroup[ww]} is a native mail client; current status: ${r}`);

                                if(r !== "Blocked"){
                                    logger.log(logfile, `[${email}] Device ID: ${mailboxGroup[ww]} is not blocked, perform block action`);
                                    blockDevice(token,urlList.blockUrl,mailboxGroup[ww],email)
                                    .then((code) => {
                                        if(code == 0){
                                            logger.csv(csv, `${email},${mid},${mailboxGroup[ww]},${r},Blocked Successfully`);
                                        }
                                        else
                                        {
                                            logger.csv(csv, `${email},${mid},${mailboxGroup[ww]},${r},Error Occured:${code}`);
                                        }
                                    });
                                }else{
                                    logger.csv(csv,`${email},${mid},${mailboxGroup[ww]},${r}`);
                                }
                            });
                        }
                    }) ();
                }
            }
            else
            {
                logger.log(logfile,`[${email}] User has multiple mail accounts but device is corporate owned, moving on.`);
                logger.csv(csv,`${email},${mid},[multiple],Exempt`);
            }
        }
        else{ // only one mailbox configured
            if(!deviceInfo.ownership){ // if not corporate owned, then continue
                if(!deviceInfo.mainMailboxMdmxx && deviceInfo.mainMailboxLength > 0){
                    getStatus(token, urlList.getStatus, deviceInfo.mainMailboxId)
                    .then((r) => {
                        logger.log(logfile, `[${email}] Device ID: ${deviceInfo.mainMailboxId} is a native mail client; current status: ${r}`);
                        if(r !== "Blocked"){
                            logger.log(logfile, `[${email}] Device ID: ${deviceInfo.mainMailboxId} is not blocked, perform block action`);
                            blockDevice(token,urlList.blockUrl,deviceInfo.mainMailboxId,email)
                            .then((code) => {

                                if(code == 0){
                                    logger.csv(csv,`${email},${mid},${deviceInfo.mainMailboxId},${r},Blocked Successfully`);
                                }
                                else
                                {
                                    logger.csv(csv, `${email},${mid},${deviceInfo.mainMailboxId},${r},Error Occured:${code}`);
                                }
                            });
                        }
                        else{
                            logger.csv(csv,`${email},${mid},${deviceInfo.mainMailboxId},${r}`);
                        }
                    });
                }
                if(!deviceInfo.secMailboxMdmxx && deviceInfo.secMailboxLength > 0) {
                    getStatus(token, urlList.getStatus, deviceInfo.secMailboxId)
                    .then((r) => {
                        logger.log(logfile, `[${email}] Device ID: ${deviceInfo.secMailboxId} is a native mail client; current status: ${r}`);
                        if(r !== "Blocked"){
                            logger.log(logfile, `[${email}] Device ID: ${deviceInfo.secMailboxId} is not blocked, perform block action`);
                            blockDevice(token,urlList.blockUrl,deviceInfo.secMailboxId,email)
                            .then((code) => {

                                if(code == 0){
                                    logger.csv(csv,`${email},${mid},${deviceInfo.secMailboxId},${r},Blocked Successfully`);
                                }
                                else
                                {
                                    logger.csv(csv, `${email},${mid},${deviceInfo.secMailboxId},${r},Error Occured:${code}`);
                                }
                            });
                        }
                        else{
                            logger.csv(csv,`${email},${mid},${deviceInfo.secMailboxId},${r}`);
                        }
                    });
                }
            }
            else
            {
                if(!deviceInfo.mainMailboxMdmxx && deviceInfo.mainMailboxLength > 0){
                    logger.log(logfile, `[${email}] Device ID: ${deviceInfo.mainMailboxId} corporate owned, moving on.`);
                    logger.csv(csv,`${email},${mid},${deviceInfo.mainMailboxId},Exempt`);
                }
                if(!deviceInfo.secMailboxMdmxx && deviceInfo.secMailboxLength > 0 && deviceInfo.secMailboxId !== deviceInfo.mainMailboxId) {
                    logger.log(logfile, `[${email}] Device ID: ${deviceInfo.secMailboxId} corporate owned, moving on.`);
                    logger.csv(csv,`${email},${mid},${deviceInfo.secMailboxId},Exempt`);
                }
            }
        }
        resolve(list);
    });
}
function stageDevice(token, deviceList, count, j, email){
    return new Promise((resolve, reject) => {
        var deviceProperties = setDeviceProperties(deviceList, count, j);
        logger.log(logfile, `[${email}] Device properties set, processing MaaS360 Device ID: ${deviceProperties.maas360DeviceID}`);
        processDevice(token, deviceProperties, email)
        .then((res) => {
        });
    })

}
function evalDevices(token, deviceList, count, email) {
    for(var i = 0; i < count; i++)
    {
        var j = i;
        stageDevice(token, deviceList, count, j , email)
        .then((res) => {

        });
    }
}
function getUserDevices(token, url, user) {
    return new Promise((resolve,reject) => {
        request({
            url: url + user,
            method: "GET",
            headers: {
              "Content-Type":"application/x-www-form-urlencode",
              "Authorization":`MaaS token="${token}"`
                  }
          }, function (error, response, body) {
            if(error) {
              //handle error
              logger.log(logfile, `[Error] ${error}: ${response.statusCode}`);
            } else if(!error && response.statusCode == 200){
                resolve(JSON.parse(body));
            }
          });
    });
}
function getStatus(token, url, id) {
    return new Promise((resolve,reject) => {
        request({
            url: url + id,
            method: "GET",
            headers: {
              "Content-Type":"application/x-www-form-urlencode",
              "Authorization":`MaaS token="${token}"`
                  }
            }, function (error, response, body) {
            if(error) {
              //handle error
                logger.log(logfile, `[Error] ${error}: ${response.statusCode}`);
            } else if(!error && response.statusCode == 200){
                parseString(body, function (err, result) {
                    resolve(result.devicesSummary.deviceAttributes[0].deviceAttribute[7].value[0].toString());
                });
            }
        });
    });
}
function findId(groupList, groupName){
    return new Promise((resolve,reject) => {
        for(var i = 0; i < groupList.group.length; i++)
        {
            var j = i;

            if(groupList.group[j].groupName.toString() === groupName)
            {
                var a = groupList.group[j].groupID.toString();
                logger.log(logfile, `[Staging] Found Group ${groupName} with Group ID ${a}`);
                resolve(a);
            }
        }
    });
}
function blockDevice(token,url,id,user) {
    return new Promise((resolve, reject) => {
        request({
            url: url + id,
            method: "POST",
            headers: {
              "Content-Type":"application/x-www-form-urlencoded",
              "Authorization":`MaaS token="${token}"`
            }
        }, function (error, response, body) {

            if(error || response.statusCode !== 200) {
                //handle error
                logger.log(logfile, `[Error] ${error}: ${response.statusCode}`);
            } else if(!error && response.statusCode == 200){
                //handle success
                parseString(body, function (err, result) {
                    var sc = result.actionResponse.actionStatus.toString();
                    logger.log(logfile, `[${user}] Device ID: ${id} successfully blocked with status code: ${sc}`);
                    resolve(sc);
                });
            }
        });
    });
}
auth(authCreds, urlList.authUrl)
.then((token) => {
    getGroups(token.toString(), urlList.getGroups)
    .then((groupList) => {
        findId(groupList,groupName)
        .then((gid) => {
            getUsers(token.toString(), urlList.getUsers, gid)
            .then((users) => {
                var c = users.users.count.toString();
                logger.log(logfile, `There are ${c} users total. We'll need to run the API ${(Math.ceil(c/pageSize))} times`);
                processUsers(token.toString(), users); // First page run

                //Handle Multiple Pages of Users...
                if(c > pageSize)
                {
                    for(var f = 1; f < Math.ceil(c / pageSize); f++){
                        getUsers(token.toString(), urlList.getUsers, gid, (f+1))
                        .then((u) => {
                            processUsers(token.toString(), u); // First page run
                        });
                    }
                }
            });
        });
    });
});
