const parse = require('csv-parser');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);


async function start(){

    let dataModel = {
        plati: {},
        polite: {},
        rbns: {},
    }

    generateData = (data) => {
        let response = {}
        for (let i = 1; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
                if (!response.hasOwnProperty(data[0][j])) {
                    response[data[0][j]] = []
                }
                if (data[i][j] || (data[i][j] === 0 && typeof data[i][j] === 'number')) {
                    response[data[0][j]].push(data[i][j])
                } else {
                    response[data[0][j]].push(null)
                }
            }
        }
        return response
    }

    async function lsExample(filename) {
        // const filename = 'Pachet_Grawe_1.3All.xlsx'
        let newFile = filename.substring(0, filename.length - 5)
        let saveFile = []
        try {
            for (i = 1; i < 4; i++){
                saveFile.push(`${newFile + "_" + i + ".csv"}`)
                let command = `python xlsx2csv.py -i -s ${i} ${filename} ${saveFile[i-1]}`

                const { stdout, stderr } = await exec(command);
                // console.log('stdout:', stdout);
                // console.error('stderr:', stderr);
            }
        } catch (error) {
            console.error(error);
        }

        return saveFile
    }

    const processFile = async (fileName) => {
        records = []
        const parser = fs
        .createReadStream(fileName)
        .pipe(parse());
        for await (const record of parser) {
          // Work with each record
          records.push(record)
        }
        return records
    }
       
    generateDataModel = async (fileName) => {
        
        const convertCSV = await lsExample(fileName);
        let sheets = ['Polite', 'RBNS', 'Plati']
        for (i = 0; i < 3; i++){
            const data = []
            const dataRow = await processFile(convertCSV[i])
            
            const columName = Object.keys(dataRow[0]);
    
            data.push(columName)
    
            for (j = 0; j < dataRow.length; j++){
                let values = Object.values(dataRow[j])
                data.push(values)
            }

            switch (sheets[i]) {
                case 'Plati':
                    dataModel.plati =  generateData(data)
                    break
                case 'Polite':
                    dataModel.polite =  generateData(data)
                    break
                case 'RBNS':
                    dataModel.rbns =  generateData(data)
                    break
            }

        }
        
        return dataModel
    }

    dataModel = await generateDataModel('./aaa.xlsx')
    console.log(dataModel)

}

start()









// const data = []

// const convertCSV = await lsExample(fileName);

// const dataRow = await processFile(convertCSV[0])

// const columName = Object.keys(dataRow[0]);

// data.push(columName)

// for (i = 0; i < dataRow.length; i++){

//     let values = Object.values(dataRow[i])
//     data.push(values)

// }

// dataModel.plati =  generateData(data)