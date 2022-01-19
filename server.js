'use strict';

var http = require('http');
var port = process.env.PORT || 1337;
var clientId = 'eftit';
var clientPrivateKey = '/Cert/custpri.pem';
var spiralPublicKey = '/Cert/spiralpub.pem';

function signing(clientId, merchantRef, isoTime) {
    const crypto = require('crypto');
    const sign = crypto.createSign('SHA256');
    const fs = require('fs');

    sign.write(clientId + merchantRef + isoTime);
    sign.end();

    const key = fs.readFileSync(clientPrivateKey);
    return sign.sign(key, 'base64');
}

function verifying(data, signature) {
    const crypto = require('crypto');
    const verify = crypto.createVerify('SHA256');
    const fs = require('fs');

    verify.write(data);
    verify.end();

    const key = fs.readFileSync(spiralPublicKey);
    return verify.verify(key, signature, 'base64');
}

function saleSession(res) {

    // set header value
    var d = new Date();
    var merchantRef = d.getTime() + Math.floor(Math.random() * 99999999).toString();
    var isoTime = d.toISOString();
    isoTime = isoTime.replace(/\.\d+/, "");

    // construct the body
    let bodyData =
    {
        'clientId': clientId,
        'cmd': 'SALESESSION',
        'type': 'VM',
        'amt': 0.1,
        'merchantRef': merchantRef.toString(),
        'channel': 'WEB',
        'successUrl': 'https://www.google.com',
        'failureUrl': 'https://www.google.com',
        'webhookUrl': 'https://www.google.com',
        'goodsName': 'Testing Goods'
    }

    // signature
    var signature_b64 = signing(clientId, merchantRef, isoTime);

    // send message
    //var URL = 'https://4923c808-5f8b-4e45-8162-1a082b3bee10.mock.pstmn.io/' + clientId + '/transactions/' + merchantRef;
    var URL = 'https://sandbox-api-checkout.spiralplatform.com/v1/merchants/' + clientId + '/transactions/' + merchantRef;

    const axios = require('axios');

    axios
        .put(URL, bodyData,
            {
                method: 'put',
                headers: {
                    'Spiral-Request-Datetime': isoTime,
                    'Spiral-Client-Signature': signature_b64
                }
            }
        )
        .then((api_res) => {
            // verify the signature
            if (verifying(clientId + merchantRef + api_res.headers['spiral-request-datetime'], api_res.headers['spiral-server-signature'])) {
                res.writeHead(api_res.status, { 'Content-Type': 'application/json' });
                res.write(`Signature Verified!\n`);
            }
            else {
                res.writeHead(api_res.status, { 'Content-Type': 'application/json' });
                res.write(`Signature Failure!\n`);
            }
            res.write(`SaleSession statusCode: ${api_res.status}`);
            res.end(JSON.stringify(api_res.data));
        })
        .catch((error) => {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(error)
            console.log(`SaleSession failed: #succ ${numSucc} #fail ${++numFail}`)
        })
}

http.createServer(function (req, res) {
    try {
        saleSession(res);
    }
    catch (error) {
        console.log(error);
    }
}).listen(port);
