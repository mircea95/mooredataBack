const xlsx = require('node-xlsx')
const { getXlsxStream } = require('xlstream');

let dataModel = {
    Polite: {},
    RBNS: {},
    Plati: {},
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

generateDataModel = (fileName) => {
    Object.getOwnPropertyNames(dataModel).forEach( async function(element) {
        
        let data = []
        const stream = await getXlsxStream({
            filePath: fileName,
            sheet: element,
            ignoreEmpty: true,
        });
        
        stream.on('data', value => {
            data.push(value.raw.arr);
            // console.log(value.raw.arr)
            // console.log(j)
            // j++
        })

        stream.on('end', function(){
            
            dataModel[element] = generateData(data)
              
        })
    });

    return dataModel
    
}

// async function start(){
//     let j = 0

//     dataModel = await generateDataModel('./MOOREDATA 3.xlsx')
//     console.log(dataModel)
//     //setTimeout(() => console.log(dataModel), 2000);
    
// }



async function start(){
    let j = 0
    array1 = ['Polite', 'RBNS', 'Plati']
    
    for (const element of array1) {
        
        let data = []
        const stream = await getXlsxStream({
            filePath: './aaa.xlsx',
            sheet: element,
            ignoreEmpty: true,
        });
      
        stream.on('data', value => {
            data.push(value.raw.arr);
        })

        stream.on('end', () => {
            dataModel[element] = generateData(data)
            console.log(element)
        })
    }

    console.log(dataModel)
    // setTimeout(() => console.log(dataModel), 2000);
    }

start()

