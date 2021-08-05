const xlsx = require('node-xlsx')
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

    generateDataModel = async (fileName) => {

        const workSheets = xlsx.parse(fileName, {
        raw: true,
     })

     // console.log(workSheets[1].name)
    //  dataModel.plati = generateData(workSheets[1].data)
     

     for (let i = 0; i < workSheets.length; i++) {
        switch (workSheets[i].name) {
            case 'Plati':
                dataModel.plati = generateData(workSheets[i].data)
                break
            case 'Polite':
                dataModel.polite = generateData(workSheets[i].data)
                break
            case 'RBNS':
                dataModel.rbns = generateData(workSheets[i].data)
                break
        }
        
     }

     return dataModel
    }


    dataModel = await generateDataModel('./2020Desp — test.xlsx')
    console.log(dataModel)
}

start()
 