const csv = require('csv-parser');
const fs = require('fs');


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

rows = []
data = []
fs.createReadStream('Pachet_Grawe_1.3All_2.csv')
  .pipe(csv())
  .on('data', (row) => {
    rows.push(row)
  })
  .on('end', () => {
    const columName = Object.keys(rows[0]);
    data.push(columName)
    for (i = 0; i < rows.length; i++){
        let values = Object.values(rows[i])
        data.push(values)
    }
    dataModel.plati = generateData(data)
    console.log(dataModel)
});


