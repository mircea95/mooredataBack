// versiunea 1.3
// Converteste excelul
// Face verificareile separat
// Incarca in baza de date fara commit

const xlsx = require('node-xlsx')
const parse = require('csv-parser');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const {pool} = require('../models/db')
const {v4: uuid4} = require('uuid')

	class XlsxParser {
		constructor(props) {
			this.user = props

			let today = new Date()

			this.date = `${today.getFullYear()}-${
				today.getMonth() + 1
			}-${today.getDate()} ${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`
		}

		dataModel = {
			plati: {},
			polite: {},
			rbns: {},
		}
    
	uuidIdPolite = {}
	errorMessages = []
	
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
	lsExample = async (filename) => {
        // const filename = 'Pachet_Grawe_1.3All.xlsx'
        let newFile = filename.substring(0, filename.length - 5)
        let saveFile = []
        try {
            for (let i = 1; i < 4; i++){
                saveFile.push(`${newFile + "_" + i + ".csv"}`)
                let command = `python xlsx2csv.py -i -s ${i} "${filename}" "${saveFile[i-1]}"`

                const { stdout, stderr } = await exec(command);
                // console.log('stdout:', stdout);
                // console.error('stderr:', stderr);
            }
        } catch (error) {
            console.error(error);
        }

        return saveFile
    }

    processFile = async (fileName) => {
        let records = []
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
	

		console.log("+- Convert Start!")
		const convertCSV = await this.lsExample(fileName);
		console.log("+- Convert Done!")
		
        let sheets = ['Polite', 'RBNS', 'Plati']
        for (let i = 0; i < 3; i++){
            const data = []
			
            let dataRow = await this.processFile(convertCSV[i])
            console.log(`+- Sheet ${i} is ready`)
            const columName = Object.keys(dataRow[0]);
    
            data.push(columName)
    
            for (let j = 0; j < dataRow.length; j++){
                let values = Object.values(dataRow[j])
                data.push(values)
            }
			dataRow = []
            switch (sheets[i]) {
                case 'Plati':
                    this.dataModel.plati =  this.generateData(data)
                    break
                case 'Polite':
                    this.dataModel.polite =  this.generateData(data)
                    break
                case 'RBNS':
					this.dataModel.rbns =  this.generateData(data)
                    break
            }

        }
		
		return this.dataModel
	}

	isNumeric = (item) => {
		return !isNaN(item)
	}

	isDate = (item) => {
		return !!Date.parse(item)
	}

	excelDateToJSDate = excelDate => {
		var date = new Date(Math.round((excelDate - (25567 + 2)) * 86400 * 1000));
		var converted_date = date.toISOString().split('T')[0];
		return converted_date;
	}
	

	politaExists = async (politaName) => {
		let query = `SELECT "PolicyId" FROM public."InsurancePolicy" WHERE "PolicyName" = '${politaName}'`

		let response = await pool.query(query)

		return !!response.rows.length
	}
	//functia care verifica daca valoarea exista in nomenclator
	genValues = (nomenclator, value) =>{
		let values = Object.keys(nomenclator).map(function(key){
			return nomenclator[key];
		});
		if (value in nomenclator || values.includes(value)) {
			return true
		} 
		return false
	}

	validatePolite = async (polite, messages) => {
		console.log("+- Start Validare Polite")
		const riskClassIdData = await this.getDataFromDB(
			"InsurancePolicyRiskClass", 
			"InsurancePolicyRiskName", 
			'InsurancePolicyRiskClassId')
		const curencyTypeIdData = await this.getDataFromDB(
			"CurrencyType", 
			"Name", 
			'Id')
		const insuranceZoneIdData = await this.getDataFromDB(
			"InsurancePolicyZone", 
			"InsurancePolicyAreaTransportName", 
			'InsurancePolicyAreaTransportId')
		const countryCodeIdData = await this.getDataFromDB(
			"CountryCode", 
			"Alpha-3", 
			'Id')
		const bmIdData = await this.getDataFromDB(
			"BMClass", 
			"Name", 
			'Id')
		const companyIdData = await this.getDataFromDB(
			"Company", 
			"CompanyName", 
			'CompanyID')

		for (let i = 0; i < polite['idPolita'].length; i++) {

			// verifica daca clasa risc este in nomenclator
			const ClasaRisc = this.genValues(riskClassIdData, polite['ClasaRisc'][i])
			if (!ClasaRisc){
				messages.push(
					`Tabela Polita: Nu sunt valide datele din c??mpul ClasaRisc - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca moneda este conform nomenclatorului
			const moneda = this.genValues(curencyTypeIdData, polite['moneda'][i])
			if (!moneda){
				messages.push(
					`Tabela Polita: Nu sunt valide datele din c??mpul moneda - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca moneda suma asig este conform nomenclatorului
			const SaMoneda = this.genValues(curencyTypeIdData, polite['SaMoneda'][i])
			if (!SaMoneda){
				messages.push(
					`Tabela Polita: Nu sunt valide datele din c??mpul SaMoneda - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca zona de deplasare este conform nomenclatorului
			if(polite['zonaDeplasare'][i]){
				const zonaDeplasare = this.genValues(insuranceZoneIdData, polite['zonaDeplasare'][i])
				if (!zonaDeplasare){
					messages.push(
						`Tabela Polita: Nu sunt valide datele din c??mpul zonaDeplasare - r??ndul (${
							i + 1
					})`,
				)}
			}
			// verifica daca viza local util este conform nomenclatorului
			const vizaLocUtil = this.genValues(countryCodeIdData, polite['vizaLocUtil'][i].split('-')[0])
			if (!vizaLocUtil){
				messages.push(
					`Tabela Polita: Nu sunt valide datele din c??mpul vizaLocUtil - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca Clasa Bonus Mallus este conform nomenclatorului
			if (polite['BM'][i]) {
				const BM = this.genValues(bmIdData, polite['BM'][i])
				if (!BM){
					messages.push(
						`Tabela Polita: Nu sunt valide datele din c??mpul BM - r??ndul (${
							i + 1
						})`,
					)
				}
			} else if(!polite['BM'][i] && polite['ClasaRisc'][i].includes('RCA')) {
				messages.push(
					`Tabela Polita: Nu sunt valide datele din c??mpul BM - r??ndul (${
						i + 1
					}) - (BM obligatoriu pentru RCA)`,
				)
			}

			// verifica daca id companie este conform nomenclatorului
			const companie = this.genValues(companyIdData, parseInt(polite['companie'][i]))
			if (!companie){
				messages.push(
					`Tabela Polita: Nu sunt valide datele din c??mpul companie - r??ndul (${
						i + 1
					})`,
				)
			}

		}

		if ('idPolita' in polite) {
			polite['idPolita'].forEach((element, index) => {
				if (element === null) {
					messages.push(
						`Tabela Polita: Nu este completat c??mpul idPolita - r??ndul (${
							index + 1
						})`,
					)
				}
			})

			let category = [
				'ClasaRisc',
				'internalMTPLid',
				'din',
				'dout',
				'PBS',
				'PBA',
				'moneda',
				'PBSM',
				'varstaPF',
				'vizaLocUtil',
				'tipVeh',
				'tipVeh2',
 				'pfPJ',
				'companie',
				'Salei',
				'SaMoneda',
				'CotaReasig',
				'Comision',
				'ChAdmin',
			]

			for (let i = 0; i < category.length; i++) {
				if (category[i] in polite) {
					polite[category[i]].forEach((element, index) => {
						if (element == null) {
							messages.push(
								`Tabela Polita: Lipsesc date in campul ${
									category[i]
								} - randul ${index + 1}`,
							)
						}
					})
				} else {
					messages.push(`Tabela Polita:  Lipseste coloana ${category[i]}`)
				}
			}

			if (messages.length) {
				return messages
			}

			// polite['idPolita'].forEach(async (element, index) => {
			// 	// if (await this.politaExists(element)) {
			// 	// 	messages.push(
			// 	// 		`Tabela Polita: Polita cu asa id deja exista in baza de date - randul ${
			// 	// 			index + 1
			// 	// 		}`,
			// 	// 	)
			// 	// }
			// 	// *******descomenteaz
			// 	// if (!polite['BM'][index] && polite['ClasaRisc'][index].includes('RCA')) {
			// 	// 	messages.push(
			// 	// 		`Tabela Polite: Nu este valid tipul datelor din campul 'BM' randul ${index}`
			// 	// 	)
			// 	// }
			// })

			polite['Salei'].forEach(async (element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'Salei' randul ${index + 1}`
					)
				}
				// } else if (!(Number(element) > 0)) {
				// 	messages.push(
				// 		`Tabela Polita: Nu este valid tipul datelor in campul 'Salei' randul ${
				// 			index + 1
				// 		}`,
				// 	)
				// }
			})

			polite['din'].forEach((element, index) => {
				if (!this.isDate(element) || !element.length == 5 || !element.length == 10) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'din' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['PBSM'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'PBSM' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['varstaPF'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'varstaPF' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['companie'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'companie' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['dout'].forEach((element, index) => {
				if (!this.isDate(element) || !element.length == 5 || !element.length == 10) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'dout' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['PBS'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'PBS' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['PBA'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'PBA' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['vizaLocUtil'].forEach((element, index) => {
				if (typeof element !== 'string') {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'vizaLocUtil' randul ${
							index + 1
						}`,
					)
				} else if (!element.includes('-')) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'vizaLocUtil' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['tipVeh'].forEach((element, index) => {
				if (typeof element !== 'string') {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'tipVeh' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['tipVeh2'].forEach((element, index) => {
				if (typeof element !== 'string') {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'tipVeh2' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['IDN'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'IDN' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['pfPJ'].forEach((element, index) => {
				if (element !== 'F' && element !== 'J') {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'pfPJ' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['Salei'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'Salei' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['CotaReasig'].forEach((element, index) => {
				if (element < 0 || element > 1 || !this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'CotaReasig' - randul ${
							index + 1
						}`,
					)
				}

				if (element != 0) {
					if (!polite['LEILiderReasig'][index]) {
						messages.push(
							`Tabela Polita: Nu este valid tipul datelor in campul 'LEILiderReasig' - randul ${index + 1}`
						)
					}
				}
			})

			polite['Comision'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'Comision' randul ${
							index + 1
						}`,
					)
				}
			})

			if (polite['ChAdmin'].length !== polite['idPolita'].length) {
				messages.push(
					`Tabela Polita: Nu sunt completate datele in campul 'ChAdmin'`,
				)
			}

			polite['ChAdmin'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'ChAdmin' randul ${
							index + 1
						}`,
					)
				}
			})
		} else {
			messages.push('Tabela Polita: Ati trecut limita maxim?? de r??nduri. (maxim tabela trebuie s?? con??in?? 190000 r??nduri)')
		}

		return messages
	}

	validateRbns = async (rbns) => {
		console.log("+- Start Validare RBNS")
		const curencyTypeIdData = await this.getDataFromDB(
			"CurrencyType", 
			"Name", 
			'Id')
		const indemnityTypeIdData = await this.getDataFromDB(
			"IndemnityType", 
			"Name", 
			'Id')
		const bineficiarIdData = await this.getDataFromDB(
			"BeneficiaryType", 
			"Name", 
			'Id'
		)
		const countryIdData = await this.getDataFromDB(
			"CountryCode", 
			"Alpha-3", 
			'Id'
		)

		const companyIdData = await this.getDataFromDB(
			"Company", 
			"CompanyName", 
			'CompanyID'
		)

		for (let i = 0; i < rbns['idPolita'].length; i++) {

			
			// verifica daca moneda este conform nomenclatorului
			const monedaDosar = this.genValues(curencyTypeIdData, rbns['moneda dosar'][i])
			if (!monedaDosar){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din c??mpul moneda dosar - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca tip dauna este conform nomenclatorului
			const tipDauna = this.genValues(indemnityTypeIdData, rbns['tipDauna'][i])
			if (!tipDauna){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din c??mpul tipDauna - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca tipBeneficiar este conform nomenclatorului
				const tipBeneficiar = this.genValues(bineficiarIdData, parseInt(rbns['tipBeneficiar'][i]))
				if (!tipBeneficiar){
					this.errorMessages.push(
						`Tabela RBNS: Nu sunt valide datele din c??mpul tipBeneficiar - r??ndul (${
							i + 1
					})`,
				)}
			
			// verifica daca taraEveniment este conform nomenclatorului
			const taraEveniment = this.genValues(countryIdData, rbns['taraEveniment'][i])
			if (!taraEveniment){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din c??mpul taraEveniment - r??ndul (${
						i + 1
					})`,
				)
			}

			// verifica daca id companie este conform nomenclatorului
			const companie = this.genValues(companyIdData, parseInt(rbns['companie'][i]))
			if (!companie){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din c??mpul companie - r??ndul (${
						i + 1
					})`,
				)
			}

		}


		if ('idPolita' in rbns) {
			rbns['idPolita'].forEach((element, index) => {
				if (element === null) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este completat c??mpul idPolita - r??ndul (${
							index + 1
						})`,
					)
				}
			})

			let category = [
				'idDosar',
				'ClasaRisc',
				'dataEveniment',
				'dataRaport',
				'miscareDataRaport',
				'moneda dosar',
				'tipDauna',
				'tipBeneficiar',
				'instanta',
				'taraEveniment',
				'companie',
				'CotaReasig',
				'ChAdmin',
			]

			for (let i = 0; i < category.length; i++) {
				if (category[i] in rbns) {
					rbns[category[i]].forEach((element, index) => {
						if (element == null) {
							this.errorMessages.push(
								`Tabela RBNS: Lipsesc date in campul ${
									category[i]
								} - randul ${index + 1}`,
							)
						}
					})
				} else {
					this.errorMessages.push(
						`Tabela RBNS: Lipseste coloana ${category[i]}`,
					)
				}
			}

			if (this.errorMessages.length) {
				return this.errorMessages
			}

			rbns['dataEveniment'].forEach((element, index) => {
				if (!this.isDate(element) || !element.length == 5 || !element.length == 10) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'dataEveniment' randul ${
							index + 1
						}`,
					)
				}
			})

			rbns['dataRaport'].forEach((element, index) => {
				if (!this.isDate(element) || !element.length == 5 || !element.length == 10) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'dataRaport' randul ${
							index + 1
						}`,
					)
				}
			})

			if (rbns['ChAdmin'].length !== rbns['idPolita'].length) {
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt completate datele in campul 'ChAdmin'`,
				)
			}

			rbns['miscareDataRaport'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'miscareDataRaport' randul ${
							index + 1
						}`,
					)
				}
			})

			rbns['companie'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'companie' randul ${
							index + 1
						}`,
					)
				}
			})

			rbns['tipBeneficiar'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'tipBeneficiar' randul ${
							index + 1
						}`,
					)
				}
			})

			rbns['instanta'].forEach((element, index) => {
				if (element.toUpperCase() !== 'DA' && element.toUpperCase() !== 'NU') {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'instanta' randul ${
							index + 1
						}`,
					)
				}
			})

			rbns['DataRefuz'].forEach((element, index) => {
				if ((!this.isDate(element) || !element.length == 5 || !element.length == 10) && rbns['DataRefuz'][index]) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'DataRefuz' randul ${
							index + 1
						}`,
					)
				}
			})

			rbns['CotaReasig'].forEach((element, index) => {
				if (element < 0 || element > 1 || !this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'CotaReasig' randul ${
							index + 1
						}`,
					)
				}

				if (element != 0) {
					if (!rbns['LEILiderReasig'][index]) {
						this.errorMessages.push(
							`Tabela RBNS: Nu este valid tipul datelor in campul 'LEILiderReasig' - randul ${index + 1}`
						)
					}
				}
			})

			rbns['ChAdmin'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'ChAdmin' randul ${
							index + 1
						}`,
					)
				}
			})
		} else {
			this.errorMessages.push(`Tabela RBNS: Ati trecut limita maxim?? de r??nduri. (maxim tabela trebuie s?? con??in?? 190000 r??nduri)`)

			return this.errorMessages
		}

		return this.errorMessages
	}

	validatePlati = async (plati) => {
		console.log("+- Start Validare Plati")
		const curencyIdData = await this.getDataFromDB(
			"CurrencyType", 
			"Name", 
			'Id')
		const indemnityTypeIdData = await this.getDataFromDB(
			"IndemnityType", 
			"Name", 
			'Id')
		const bineficiarIdData = await this.getDataFromDB(
			"BeneficiaryType", 
			"Name", 
			'Id'
		)
		const countryIdData = await this.getDataFromDB(
			"CountryCode", 
			"Alpha-3", 
			'Id'
		)

		const companyIdData = await this.getDataFromDB(
			"Company", 
			"CompanyName", 
			'CompanyID')
		for (let i = 0; i < plati['idPolita'].length; i++) {

			// verifica daca moneda este conform nomenclatorului
			const moneda = this.genValues(curencyIdData, plati['moneda'][i])
			if (!moneda){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din c??mpul moneda - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca tip dauna este conform nomenclatorului
			const tipDauna = this.genValues(indemnityTypeIdData, plati['tipDauna'][i])
			if (!tipDauna){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din c??mpul tipDauna - r??ndul (${
						i + 1
					})`,
				)
			}
			// verifica daca tipBeneficiar este conform nomenclatorului
			const tipBeneficiar = this.genValues(bineficiarIdData, parseInt(plati['tipBeneficiar'][i]))
			if (!tipBeneficiar){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din c??mpul tipBeneficiar - r??ndul (${
						i + 1
				})`,
			)}
			
			// verifica daca taraEveniment este conform nomenclatorului
			const taraEveniment = this.genValues(countryIdData, plati['taraEveniment'][i])
			if (!taraEveniment){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din c??mpul taraEveniment - r??ndul (${
						i + 1
					})`,
				)
			}

			// verifica daca id companie este conform nomenclatorului
			const companie = this.genValues(companyIdData, parseInt(plati['companie'][i]))
			if (!companie){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din c??mpul companie - r??ndul (${
						i + 1
					})`,
				)
			}

		}


		if ('idPolita' in plati) {
			plati['idPolita'].forEach((element, index) => {
				if (element === null) {
					this.errorMessages.push(
						`Tabela Plati: Nu este completat c??mpul idPolita - r??ndul (${
							index + 1
						})`,
					)
				}
			})

			let category = [
				'idDosar',
				'ClasaRisc',
				'dataEveniment',
				'dataRaport',
				'miscareDataRaport',
				'moneda',
				'tipDauna',
				'tipBeneficiar',
				'instanta',
				'taraEveniment',
				'companie',
				'CotaReasig',
				'ChAdmin',
			]

			for (let i = 0; i < category.length; i++) {
				if (category[i] in plati) {
					plati[category[i]].forEach((element, index) => {
						if (element == null) {
							this.errorMessages.push(
								`Tabela Plati: Lipsesc date in campul ${
									category[i]
								} - randul ${index + 1}`,
							)
						}
					})
				} else {
					this.errorMessages.push(
						`Tabela Plati: Lipeste coloana ${category[i]}`,
					)
				}
			}

			if (this.errorMessages.length) {
				return this.errorMessages
			}

			plati['dataEveniment'].forEach((element, index) => {
				if (!this.isDate(element) || !element.length == 5 || !element.length == 10) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'dataEveniment' randul ${
							index + 1
						}`,
					)
				}
			})

			plati['dataRaport'].forEach((element, index) => {
				if (!this.isDate(element) || !element.length == 5 || !element.length == 10) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'dataRaport' randul ${
							index + 1
						}`,
					)
				}
			})

			if (plati['ChAdmin'].length !== plati['idPolita'].length) {
				this.errorMessages.push(
					`Tabela Plati: Nu sunt completate datele in campul 'ChAdmin'`,
				)
			}

			plati['miscareDataRaport'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'miscareDataRaport' randul ${
							index + 1
						}`,
					)
				}
			})

			plati['companie'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'companie' randul ${
							index + 1
						}`,
					)
				}
			})

			plati['instanta'].forEach((element, index) => {
				if (element.toUpperCase() !== 'DA' && element.toUpperCase() !== 'NU') {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'instanta' randul ${
							index + 1
						}`,
					)
				}
			})

			plati['DataRefuz'].forEach((element, index) => {
				if ((!this.isDate(element) || !element.length == 5 || !element.length == 10) && plati['DataRefuz'][index]) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'DataRefuz' randul ${
							index + 1
						}`,
					)
				}
			})

			plati['CotaReasig'].forEach((element, index) => {
				if (element < 0 || element > 1 || !this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'CotaReasig' randul ${
							index + 1
						}`,
					)
				}

				if (element != 0) {
					if (!plati['LEILiderReasig'][index]) {
						this.errorMessages.push(
							`Tabela Plati: Nu este valid tipul datelor in campul 'LEILiderReasig' - randul ${index + 1}`
						)
					}
				}
			})

			plati['tipBeneficiar'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'tipBeneficiar' randul ${
							index + 1
						}`,
					)
				}
			})

			plati['ChAdmin'].forEach((element, index) => {
				if (!this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'ChAdmin' randul ${
							index + 1
						}`,
					)
				}
			})
		} else {
			this.errorMessages.push(`Tabela Plati: Ati trecut limita maxim?? de r??nduri. (maxim tabela trebuie s?? con??in?? 190000 r??nduri)`)

			return this.errorMessages
		}

		return this.errorMessages
	}
//Functii utilizate in procesul de verificare si adaugare in DB
	//Extrage toate datele adaugate in numenclatoarele din DB
	getDataFromDB = async (tableName, columName, idname) => {
			
		let query = `
		SELECT * FROM "${process.env.DB_NAME}".public."${tableName}"`
		const existing = await pool.query(query)
		let tabel = {}
		for (let i = 0; i < existing.rows.length; i++) {
			let key = existing.rows[i][columName]
			tabel[key] = existing.rows[i][idname]
		}
		
		if (Object.keys(tabel).length > 0) {
			return tabel
		}
		
		throw new Error(`${tableName}: Nu au fost identificate Nomenclatoare in DB. Contactati Administratorul!`);
	}
	//Verifica nomenclatoarele - coloanele din excel cu nomenclatoarele existente in BD
	checkData = async (nomenc, value) => {
		let values = Object.keys(nomenc).map(function(key){
			return nomenc[key];
		});
		if (value in nomenc) {
			return nomenc[value]
		} else if (values.includes(value)){
			return value
		}
		console.log(`${value} not in nomenclator`)
	}

	checkID = async(checkTab, politeTab, tabName, Messages) => {
		
		checkTab['idPolita'].forEach((element, index) => {
			
			let testCheck = politeTab['idPolita'].includes(element)
			
			if (testCheck === false) {
				Messages.push(
					`Tabela ${tabName}: idPolita nu exist?? ??n tabela Polite - r??ndul (${
						index + 1
					})`,
				)
			}
		})
		checkTab = []
		politeTab = []
		return Messages
	}

	uuidCreate = async (keyValue) => {
		if (keyValue in this.uuidIdPolite) {
			// return this.uuidIdPolite[keyValue]
			return uuid4()
		} else {
			this.uuidIdPolite[keyValue] = uuid4()
			return this.uuidIdPolite[keyValue]
		}
	}

	getUuid = async (keyValue) => {
		if (keyValue in this.uuidIdPolite) {
			return this.uuidIdPolite[keyValue]
		}
		throw new Error(`Nu poate fi extras uuid pentru idPolita: ${keyValue}. Contactati Administratorul!`)
	}

	//Functia care adauga date in tabelul cu Polite
	createInsurancePolicy = async (polite) => {
		try {
			let policyId
			let riskClassId
			let din
			let dout
			let curencyTypeId
			let curencyTypeId1
			let insuranceZoneId
			let countryCodeId
			let bmId
			let companyId
			console.log("+- Get nomenclators for Policy")
			const riskClassIdData = await this.getDataFromDB(
				"InsurancePolicyRiskClass", 
				"InsurancePolicyRiskName", 
				'InsurancePolicyRiskClassId')
			const curencyTypeIdData = await this.getDataFromDB(
				"CurrencyType", 
				"Name", 
				'Id')
			const insuranceZoneIdData = await this.getDataFromDB(
				"InsurancePolicyZone", 
				"InsurancePolicyAreaTransportName", 
				'InsurancePolicyAreaTransportId')
			const countryCodeIdData = await this.getDataFromDB(
				"CountryCode", 
				"Alpha-3", 
				'Id')
			const bmIdData = await this.getDataFromDB(
				"BMClass", 
				"Name", 
				'Id')
			const companyIdData = await this.getDataFromDB(
				"Company", 
				"CompanyName", 
				'CompanyID')
			console.log("+- Nomenclators for Policy is ready")
		

			for (let i = 0; i < polite['idPolita'].length; i++) {
				policyId = await this.uuidCreate(polite['idPolita'][i])
				
				riskClassId = await this.checkData(
					riskClassIdData,
					polite['ClasaRisc'][i],
				)
				
				//Data - Verifica formatul de data din excel si il transforma in formatul js
				din = this.isNumeric(polite['din'][i]) ? this.excelDateToJSDate(polite['din'][i]) : polite['din'][i]

				dout = this.isNumeric(polite['dout'][i]) ? this.excelDateToJSDate(polite['dout'][i]) : polite['dout'][i]

				curencyTypeId = await this.checkData(
					curencyTypeIdData,
					polite['moneda'][i],
				)

				curencyTypeId1 = await this.checkData(
					curencyTypeIdData,
					polite['SaMoneda'][i],
				)

				insuranceZoneId = polite['zonaDeplasare'][i] ? "'" + await this.checkData(
					insuranceZoneIdData,
					polite['zonaDeplasare'][i],
				) + "'" : null;
				
				countryCodeId = await this.checkData(
					countryCodeIdData,
					polite['vizaLocUtil'][i].split('-')[0],
				)
				
				if (polite['ClasaRisc'][i].includes('RCA') && polite['BM'][i]) {
					bmId = "'" + await this.checkData(bmIdData, polite['BM'][i]) + "'"
				} else if (!polite['ClasaRisc'][i].includes('RCA')) {
					bmId = polite['BM'][i] ? "'" + await this.checkData(bmIdData, polite['BM'][i]) + "'": null;
				} else {
					bmId = "'" + await this.checkData(bmIdData, polite['BM'][i]) + "'"
				}
				
				companyId = await this.checkData(
					companyIdData,
					parseInt(polite['companie'][i]),
				)
				
				let query = `
                    INSERT INTO public."InsurancePolicy"(
                        "PolicyId",
                        "PolicyName",
                        "RiskClassId",
                        "InternalMTPolicyID",
                        "StartTime",
                        "EndTime",
                        "PBS",
                        "CurrencyTypeOriginalId",
                        "PolicyZoneId",
                        "CountryCodeIssueId",
                        "CountryLocationIssueName",
                        "PersonalNumber",
						"PolicyDescription",
						"PBSM",
						"PersonAge",
                        "BMClassId",
                        "IsLegalEntity",
                        "CompanyId",
                        "MaximumInsuredAmount",
                        "CurrencyInsuredAmountTypeId",
                        "ReinsuranceShare",
                        "LEILiderReasig",
                        "Commission",
                        "AdministrativeFee",
                        "PBA",
                        "PolicyParam1",
                        "PolicyParam2",
                        "InsurredObjectId",
                        "UserId",
                        "CreationDateTimeRow"
                    )
                    VALUES (
                        '${policyId}',
                        '${polite['idPolita'][i]}',
                        '${riskClassId}',
                        '${polite['internalMTPLid'][i]}',
                        '${din}',
                        '${dout}',
                        '${polite['PBS'][i]}',
                        '${curencyTypeId}',
                        ${insuranceZoneId},
                        '${countryCodeId}',
                        '${polite['vizaLocUtil'][i].split('-')[1]}',
                        ${polite['IDN'][i]},
						'${polite['Produs'][i]}',
						'${polite['PBSM'][i]}',
						'${polite['varstaPF'][i]}',
                        ${bmId},
                        '${polite['pfPJ'][i] === 'F' ? 0 : 1}',
                        '${companyId}',
                        ${polite['Salei'][i]},
                        '${curencyTypeId1}',
                        ${polite['CotaReasig'][i]},
                        '${polite['LEILiderReasig'][i]}',
                        ${polite['Comision'][i]},
                        ${polite['ChAdmin'][i]},
                        '${polite['PBA'][i]}',
                        '${polite['tipVeh'][i]}',
                        '${polite['tipVeh2'][i]}',
                        '${polite['nrAuto'][i]}',
                        '${this.user.id}',
                        '${this.date}'
                    );
                `
				console.log(`Polite: ${i}`)		
				await pool.query(query)
				query = null
			}
		} catch (e) {
			this.errorMessages.push(`Tabela polite: ${e.message}`)
			console.log(e)
			throw new Error()
		}
	}
	
	createInsurancePolicyRBNS = async (rbns) => {
		try {
			let policyID
			let dataEveniment
			let dataRaport
			let dataRefuz
			let curencyTypeId
			let indemnityTypeId
			let bineficiarId
			let countryId
			let companyId
			console.log("+- Get nomenclators for RBNS")
			const curencyTypeIdData = await this.getDataFromDB(
				"CurrencyType", 
				"Name", 
				'Id')
			const indemnityTypeIdData = await this.getDataFromDB(
				"IndemnityType", 
				"Name", 
				'Id')
			const bineficiarIdData = await this.getDataFromDB(
				"BeneficiaryType", 
				"Name", 
				'Id'
			)
			const countryIdData = await this.getDataFromDB(
				"CountryCode", 
				"Alpha-3", 
				'Id'
			)

			const companyIdData = await this.getDataFromDB(
				"Company", 
				"CompanyName", 
				'CompanyID')
			console.log("+- Nomenclators for RBNS is ready")
			for (let i = 0; i < rbns['idPolita'].length; i++) {
				policyID = await this.getUuid(
					rbns['idPolita'][i]
				)

				curencyTypeId = await this.checkData(
					curencyTypeIdData,
					rbns['moneda dosar'][i],
				)
				indemnityTypeId = await this.checkData(
					indemnityTypeIdData,
					rbns['tipDauna'][i],
				)

				bineficiarId = await this.checkData(
					bineficiarIdData,
					parseInt(rbns['tipBeneficiar'][i]),
				)
				countryId = await this.checkData(
					countryIdData,
					rbns['taraEveniment'][i],
				)
				companyId = await this.checkData(
					companyIdData,
					parseInt(rbns['companie'][i]),
				)

				dataEveniment = this.isNumeric(rbns['dataEveniment'][i]) ? this.excelDateToJSDate(rbns['dataEveniment'][i]) : rbns['dataEveniment'][i]
				dataRaport = this.isNumeric(rbns['dataRaport'][i]) ? this.excelDateToJSDate(rbns['dataRaport'][i]) : rbns['dataRaport'][i]
				dataRefuz = rbns['DataRefuz'][i] ? ( this.isNumeric(rbns['DataRefuz'][i]) ? "'" + this.excelDateToJSDate(rbns['DataRefuz'][i]) + "'" : "'" + rbns['DataRefuz'][i] + "'" ) : null

				let query = `
                    INSERT INTO "${process.env.DB_NAME}".public."InsurancePolicyRbns"(
                        "RbnsId",
                        "PolicyId",
                        "EvenimentDate",
                        "EvenimentRegisterDate",
                        "CurrencyTypeOriginalId",
                        "DossierId",
                        "IndemnityTypeId",
                        "miscareDataRaport",
                        "BeneficiaryTypeId",
                        "IsIstance",
                        "EvenimentProducedCountryId",
                        "ComplanyId",
                        "RefusalPayCompensationDate",
                        "ReinsuranceShare",
                        "LEILiderReasig",
                        "AdministrativeExpenses",
                        "UserId",
                        "CreationDateTimeRow"
                    )
                    VALUES (
                        '${uuid4()}',
                        '${policyID}',
                        '${rbns['dataEveniment'][i]}',
                        '${rbns['dataRaport'][i]}',
                        '${curencyTypeId}',
                        '${rbns['idDosar'][i]}',
                        '${indemnityTypeId}',
                        '${rbns['miscareDataRaport'][i]}',
                        '${bineficiarId}',
                        '${rbns['instanta'][i] === 'DA' ? 1 : 0}',
                        '${countryId}',
                        '${companyId}',
                        ${dataRefuz},
                        '${rbns['CotaReasig'][i]}',
                        '${rbns['LEILiderReasig'][i]}',
                        '${rbns['ChAdmin'][i]}',
                        '${this.user.id}',
                        '${this.date}'
                    )
                `
				console.log(`RBNS: ${i}`)	
				await pool.query(query)	
			}
		} catch (e) {
			this.errorMessages.push('Tabela RBNS: ' + e.message)
			console.log(e)
			throw new Error()
		}
	}

	createInsurancePolicyIndemnity = async (insurance) => {
		try {
			let policyId
			let dataEveniment
			let dataRaport
			let dataRefuz
			let curencyId
			let indemnityTypeId
			let bineficiarId
			let countryId
			let companyId
			console.log("+- Get nomenclators for PolicyIndemnity")
			const curencyIdData = await this.getDataFromDB(
				"CurrencyType", 
				"Name", 
				'Id')
			const indemnityTypeIdData = await this.getDataFromDB(
				"IndemnityType", 
				"Name", 
				'Id')
			const bineficiarIdData = await this.getDataFromDB(
				"BeneficiaryType", 
				"Name", 
				'Id'
			)
			const countryIdData = await this.getDataFromDB(
				"CountryCode", 
				"Alpha-3", 
				'Id'
			)

			const companyIdData = await this.getDataFromDB(
				"Company", 
				"CompanyName", 
				'CompanyID')
			console.log("+- Nomenclators for PolicyIndemnity is ready")
			for (let i = 0; i < insurance['idPolita'].length; i++) {
				policyId = await this.getUuid(
					insurance['idPolita'][i]
				)
				curencyId = await this.checkData(
					curencyIdData,
					insurance['moneda'][i],
				)
				indemnityTypeId = await this.checkData(
					indemnityTypeIdData,
					insurance['tipDauna'][i],
				)
				bineficiarId = await this.checkData(
					bineficiarIdData,
					parseInt(insurance['tipBeneficiar'][i]),
				)
				countryId = await this.checkData(
					countryIdData,
					insurance['taraEveniment'][i],
				)
				companyId = await this.checkData(
					companyIdData,
					parseInt(insurance['companie'][i]),
				)
				
				dataEveniment = this.isNumeric(insurance['dataEveniment'][i]) ? this.excelDateToJSDate(insurance['dataEveniment'][i]) : insurance['dataEveniment'][i]
				dataRaport = this.isNumeric(insurance['dataRaport'][i]) ? this.excelDateToJSDate(insurance['dataRaport'][i]) : insurance['dataRaport'][i]
				dataRefuz = insurance['DataRefuz'][i] ? ( this.isNumeric(insurance['DataRefuz'][i]) ? "'" + this.excelDateToJSDate(insurance['DataRefuz'][i]) + "'" : "'" + insurance['DataRefuz'][i] + "'" ) : null

				let query = `
                    INSERT INTO public."InsurancePolicyIndemnity"(
                        "IndemnityId",
                        "PolicyId",
                        "EvenimentDate",
                        "EvenimentRegisterDate",
                        "CurrencyTypeOriginalId",
                        "DossierId",
                        "IndemnityTypeId",
                        "miscareDataRaport",
                        "BeneficiaryTypeId",
                        "IsIstance",
                        "EvenimentProducedCountryId",
                        "ComplanyId",
                        "RefusalPayCompensationDate",
                        "ReinsuranceShare",
                        "LEILiderReasig",
                        "AdministrativeExpenses",
                        "UserId",
                        "CreationDateTimeRow"
                    )
                    VALUES (
                        '${uuid4()}',
                        '${policyId}',
                        '${dataEveniment}',
                        '${dataRaport}',
                        '${curencyId}',
                        '${insurance['idDosar'][i]}',
                        '${indemnityTypeId}',
                        '${insurance['miscareDataRaport'][i]}',
                        '${bineficiarId}',
                        '${insurance['instanta'][i] === 'DA' ? 1 : 0}',
                        '${countryId}',
                        '${companyId}',
                        ${dataRefuz},
                        '${insurance['CotaReasig'][i]}',
                        '${insurance['LEILiderReasig'][i]}',
                        '${insurance['ChAdmin'][i]}',
                        '${this.user.id}',
                        '${this.date}'
                    )
                `
				console.log(`Plati: ${i}`)
				await pool.query(query)
			}
		} catch (e) {
			this.errorMessages.push('Tabela plati: ' + e.message)
			console.log(e)
			throw new Error()
		}
	}

	saveData = async (data) => {
		try {
			// await pool.query('BEGIN')
			
			await this.createInsurancePolicy(data['polite'])
			await this.createInsurancePolicyRBNS(data['rbns'])
			await this.createInsurancePolicyIndemnity(data['plati'])
			console.log('Trecut')
			let query = `
            INSERT INTO public."PackageLoaded"(
                "Id", "UserId", "DateTime", "TotalPolicies", "TotalRbns", "TotalPayments")
                VALUES (
                '${uuid4()}',
                '${this.user.id}',
                '${this.date}',
                '${data['polite']['idPolita'].length}',
                '${data['rbns']['idPolita'].length}',
                '${data['plati']['idPolita'].length}'
                );`

			await pool.query(query)
			// await pool.query('COMMIT')
		} catch (e) {
			// await pool.query('ROLLBACK')

			console.log(e)
		}
	}

	verifyData = async (data) => {
		this.errorMessages = await this.validatePolite(data.polite, this.errorMessages)
		await this.validateRbns(data.rbns)
		await this.validatePlati(data.plati)

		const used = process.memoryUsage().heapUsed / 1024 / 1024;
		console.log(`The script now uses approximately ${Math.round(used * 100) / 100} MB`);

		if (this.errorMessages.length) {
			return this.errorMessages
		}
		//
		console.log("+- Check RBNS ID")
		this.errorMessages = await this.checkID(data.rbns, data.polite, 'RBNS', this.errorMessages)
		if (this.errorMessages.length) {
			return this.errorMessages
		}
		//
		console.log("+- Check Plati ID")
		this.errorMessages = await this.checkID(data.plati, data.polite, 'Plati', this.errorMessages)
		if (this.errorMessages.length) {
			return this.errorMessages
		}
		//
		console.log("+- Now save data")
		await this.saveData(data)

		if (this.errorMessages.length) {
			return this.errorMessages
		}

		return ['Success']
	}
}

module.exports = XlsxParser
