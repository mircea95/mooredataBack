const formidable = require('formidable')
const fs = require('fs-extra')
const path = require('path')
const XlsxParser = require('../xlsx/xlsxParser')

exports.uploadFile = async (req, res) => {
    req.pipe(req.busboy);
    req.setTimeout(600000);
    req.busboy.on('file', (fieldname, file, filename) => {
        if (!fs.existsSync(path.join(__dirname, '../uploads', filename))) {
            fs.createFileSync(path.join(__dirname, '../uploads', filename));
        }
        
        const fstream = fs.createWriteStream(path.join(__dirname, '../uploads', filename));
        file.pipe(fstream);

        fstream.on('close', async () => {
            console.log('File uploaded, started parsing the file', filename);
            let xlsx = new XlsxParser(req.user)
            let dataModel = await xlsx.generateDataModel(path.join(__dirname, '../uploads', filename))

            let data = ['Fisierul a fost incarcat cu success']

            data = await xlsx.verifyData(dataModel)

            res.send({
                status: true,
                message: 'File is uploaded',
                data: data,
            })
        })
    })
}
