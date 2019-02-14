const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(cors());

exports.generateSFEIRCV = (req, res) => {

    console.log('Check environment => ' + process.env.NODE_ENV);

    res.set('Access-Control-Allow-Origin', "*")
    res.set('Access-Control-Allow-Methods', 'GET, POST')

    const {Storage} = require('@google-cloud/storage');
    const storage = new Storage({
        projectId: 'sfeircvgenerator',
    });
    const bucketName = 'sfeircvgenerator-storage';

    storage
        .getBuckets()
        .then((results) => {
            const buckets = results[0];
            buckets.forEach((bucket) => {
                if (bucket.name === bucketName) {
                    const pdf = require('html-pdf');
                    let cvName = req.body.cvName + '.pdf' || 'no cvName found';
                    let email = req.body.email || 'wajdibenabdalla@gmail.com';
                    let htmlTextContent = req.body.htmlTextContent ||
                        `<html><title></title><body>No HTML found</body></html>`;

                    if (process.env.NODE_ENV === 'development') {
                        htmlTextContent = fs.readFileSync(path.join(__dirname, '/test_data/test.html'), 'utf8');
                        pdf.create(htmlTextContent, {format: 'A4'})
                            .toBuffer(function (err, buffer) {
                                if (err) return console.log(err);
                                fs.writeFile("test1.pdf", buffer, "binary", function (err) {
                                    if (err) {
                                        res.send(err);
                                    } else {
                                        res.send("The file was saved!");
                                    }
                                });
                            });
                    } else if (process.env.NODE_ENV === 'production') {
                        pdf.create(htmlTextContent, {format: 'A4'})
                            .toBuffer(function (error, buffer) {
                                if (error) return console.log(error);
                                const myFileBucket = bucket.file(cvName);
                                const encryptionKey = crypto.randomBytes(32);
                                myFileBucket.setEncryptionKey(encryptionKey);
                                myFileBucket.save(buffer).then(() => {
                                    myFileBucket.makePublic().then(() => {
                                        console.log('The file is public now');
                                        let link = `https://storage.googleapis.com/${bucketName}/${cvName}`;
                                        sendMail(email, link).then((redirect) => {
                                            res.send('Le mail a été envoyé : ' + redirect);
                                        }).catch((error) => {
                                            console.dir(error);
                                        })
                                    })
                                })
                            });
                    } else {
                        res.status(404).send('unknown environment');
                    }
                } else {
                    res.status(404).send('No bucket');
                }
            });
        })
        .catch((err) => {
            console.error('ERROR:', err);
        });
};

async function sendMail(email, link) {

    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let account = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: account.user, // generated ethereal user
            pass: account.pass // generated ethereal password
        }
    });

    // setup email data with unicode symbols
    let mailOptions = {
        from: 'SFEIR<example@sfeir.com>', // sender address
        to: email, // list of receivers
        subject: "Mail Sfeir", // Subject line
        text: "", // plain text body
        html: `<br>Vous trouverez ci-joint votre CV.
                <a href="${link}">myCV` // html body
    };

    // send mail with defined transport object
    let info = await transporter.sendMail(mailOptions)

    console.log("Message sent: %s", info.messageId);
    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

    return nodemailer.getTestMessageUrl(info);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}


app.post('/', (req, res) => {
    this.generateSFEIRCV(req, res, true);
})

app.listen(4500, () => {
    console.log('server running in environment => ' + process.env.NODE_ENV);
})
