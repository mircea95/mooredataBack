const { getXlsxStream } = require('xlstream');

const filename = './Pachet_Grawe_1.3.xlsx'
// const filename = './MOOREDATA 3.xlsx'

const data = [];
let i = 0
async function start(){
    
    
    const stream = await getXlsxStream({
        filePath: filename,
        sheet: 0,
        withHeader: true,
        ignoreEmpty: true,
    });

    stream.on('data', value => {
        data.push(value.raw.arr);
        console.log(i)
        i++
    })
    stream.on('end', () => {
        console.log(data)
    })
  
}

start()


// setTimeout(() => console.log(data), 1000);


// let array = [];

// async function importExcelFile(file) {
//     let stream;
//     try {
//       stream = await getXlsxStream({
//         filePath: file,
//         sheet: 0,
//         ignoreEmpty: true,
//       });
//     } catch (err) {
//       console.log(err);
//     }

//     stream.on('data', async (x) => {
     
//         array.push(x.raw.arr)
//         console.log(x.raw.arr);
       
//     });
//     stream.on('error', (error) => {
//       console.log(error);
//     });
    
//     return array;
// }

// array = importExcelFile(filename)
// console.count(array)
