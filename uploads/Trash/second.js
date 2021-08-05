const ExcelJS = require('exceljs');

const filename = './Pachet_Grawe_1.3.xlsx'
async function start(){
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filename)
        .then(function() {
            var worksheet = workbook.getWorksheet("Polite");
            
            row = worksheet.getRow(1).values;
            console.log(row)
            // worksheet.eachRow({includeEmpty: false }, 
            //     function(row) {  
            //         if (row.values != ''){
            //             console.log("Row " + " = " + JSON.stringify(row.values));
            //         }
                    
            //     });
        });
    
}
start()