// versiunea 1.3
// Converteste excelul
// Permite daca in RBNS si Plati nui nimic
const crypto = require('crypto');
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
		clientFile = ''
		fileHashValue = ''
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
				data[i][j] = ''
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
				try {
					let csvFile = `${newFile + "_" + i + ".csv"}`
                	let command = `python xlsx2csv.py -i -s ${i} "${filename}" "${csvFile}"`
                	const { stdout, stderr } = await exec(command);
                	// console.log('stdout:', stdout);
                	// console.error('stderr:', stderr);
					saveFile.push(csvFile)
				} catch (error) {
					console.log(`Sheet ${i} lipseste!`)
				}
                
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

	getHash = async () => {
		let query = `
		SELECT "FileHash" FROM "${process.env.DB_NAME}".public."PackageLoaded"`
		const response = await pool.query(query)
		const allDataHash = []
		for(let i = 0; i < response.rows.length; i++){
			Object.keys(response.rows[i]).forEach((k) => response.rows[i][k] == null && delete response.rows[i][k]);
			if(response.rows[i]['FileHash'] !== undefined){
				allDataHash.push(response.rows[i]['FileHash'])
			}
		  }

		return allDataHash
		
	}

	generateDataModel = async (fileName) => {
		// Inregistrare log in fisier cu denumirea fisierului si Id utilizator care incearca sa incarce
		this.clientFile = fileName + "---" + this.user.id + "---" + this.date

		fs.appendFile('companytry.txt', `${this.clientFile}\n`, function (err) {
			if (err) throw err;
			console.log('File companytry.txt Updated!');
		});
		// Sfirsit Inregistrare log in fisier

		// Start Verificare Hash - Se genereaza hash pentru fisier si se verifica daca asa fisier a mai fost incarcat
		const existingHash = await this.getHash()
		
		const hashSum = crypto.createHash('md5');
		hashSum.update(fileName);
		this.fileHashValue = hashSum.digest('hex');

		if(existingHash.includes(this.fileHashValue)){
			return "File_Exist"
		}
		// Sfirsit verificare Hash

		console.log("+- Convert Start!")
		const convertCSV = await this.lsExample(fileName);
		console.log("+- Convert Done!")
		
        let sheets = ['Polite', 'RBNS', 'Plati']
        for (let i = 0; i < 3; i++){
            const data = []
			let dataRow
			console.log(`+- Start load sheet ${i+1}`)
			try {
				if (convertCSV[i]){
					dataRow = await this.processFile(convertCSV[i])
				} else {
					return null
				}
			} catch {
				return null
			}
			
            
            console.log(`+- Sheet ${i+1} is ready`)
            
			// if(!dataRow.length){
			// 	return null
			// }
			
			if(dataRow.length){
				
				const columName = Object.keys(dataRow[0]);
				const columNameTrim = columName.map(string => typeof string  === 'string' ? string.trim() : string)
            	data.push(columNameTrim)
			
				for (let j = 0; j < dataRow.length; j++){
				
					let values = Object.values(dataRow[j])
					const valuesTrim = values.map(string => typeof string  === 'string' ? string.trim() : string)
					data.push(valuesTrim)
					dataRow[j] = ''
		
				}
				dataRow = ''
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

		

		if ('idPolita' in polite) {
			polite['idPolita'].forEach((element, index) => {
				if (element === null) {
					messages.push(
						`Tabela Polita: Nu este completat câmpul idPolita - rândul (${
							index + 1
						})`,
					)
				}
			})

			let category = [
				'ClasaRisc',
				'Produs',
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
			///HERE Verificam daca sunt (')
			polite['idPolita'].forEach(async (element, index) => {

				if (element.includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul idPolita - rândul ${index + 1}`
					)
				}

				if (polite['internalMTPLid'][index].includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul internalMTPLid - rândul ${index + 1}`
					)
				}
				
				if (polite['Produs'][index].includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul Produs - rândul ${index + 1}`
					)
				}

				if (polite['LEILiderReasig'][index] && polite['LEILiderReasig'][index].includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul LEILiderReasig - rândul ${index + 1}`
					)
				}

				if (polite['tipVeh'][index].includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul tipVeh - rândul ${index + 1}`
					)
				}

				if (polite['tipVeh2'][index].includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul tipVeh2 - rândul ${index + 1}`
					)
				}
				if (polite['nrAuto'][index] && polite['nrAuto'][index].includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul nrAuto - rândul ${index + 1}`
					)
				}
			
			})

			polite['Salei'].forEach(async (element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'Salei' randul ${index + 1}`
					)
				}
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
				}
				if (element.includes("'")) {
					messages.push(
						`Tabela Polita: Caracterul (') - nu poate fi procesat, câmpul vizaLocUtil - rândul (${
							index + 1
						})`,
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
			messages.push(`Tabela Polita:  Nu a fost identificata coloana idPolita. Verificați dacă denumirile coloanelor 
			și structura documentului este conform ghidului!`)
			return this.errorMessages
		}

		if ('idPolita' in polite){
			for (let i = 0; i < polite['idPolita'].length; i++) {

				// verifica daca clasa risc este in nomenclator
				const ClasaRisc = this.genValues(riskClassIdData, polite['ClasaRisc'][i])
				if (!ClasaRisc){
					messages.push(
						`Tabela Polita: Nu sunt valide datele din cîmpul ClasaRisc - rândul (${
							i + 1
						})`,
					)
				}
				// verifica daca moneda este conform nomenclatorului
				const moneda = this.genValues(curencyTypeIdData, polite['moneda'][i])
				if (!moneda){
					messages.push(
						`Tabela Polita: Nu sunt valide datele din cîmpul moneda - rândul (${
							i + 1
						})`,
					)
				}
				// verifica daca moneda suma asig este conform nomenclatorului
				const SaMoneda = this.genValues(curencyTypeIdData, polite['SaMoneda'][i])
				if (!SaMoneda){
					messages.push(
						`Tabela Polita: Nu sunt valide datele din cîmpul SaMoneda - rândul (${
							i + 1
						})`,
					)
				}
				// verifica daca zona de deplasare este conform nomenclatorului
				if(polite['zonaDeplasare'][i]){
					const zonaDeplasare = this.genValues(insuranceZoneIdData, polite['zonaDeplasare'][i])
					if (!zonaDeplasare){
						messages.push(
							`Tabela Polita: Nu sunt valide datele din cîmpul zonaDeplasare - rândul (${
								i + 1
						})`,
					)}
				}
				// verifica daca viza local util este conform nomenclatorului
				if (polite['vizaLocUtil'][i]){
					const vizaLocUtil = this.genValues(countryCodeIdData, polite['vizaLocUtil'][i].split('-')[0])
					if (!vizaLocUtil){
						messages.push(
							`Tabela Polita: Nu sunt valide datele din cîmpul vizaLocUtil - rândul (${
								i + 1
							})`,
						)
					}
				}
				
				// verifica daca Clasa Bonus Mallus este conform nomenclatorului
				if (polite['BM'][i]) {
					const BM = this.genValues(bmIdData, polite['BM'][i])
					if (!BM){
						messages.push(
							`Tabela Polita: Nu sunt valide datele din cîmpul BM - rândul (${
								i + 1
							})`,
						)
					}
				} else if(!polite['BM'][i] && polite['ClasaRisc'][i]) {
					if (polite['ClasaRisc'][i].includes('RCA')){
						messages.push(
							`Tabela Polita: Nu sunt valide datele din cîmpul BM - rândul (${
								i + 1
							}) - (BM obligatoriu pentru RCA)`,
						)
					}
					
				} 
	
				// verifica daca id companie este conform nomenclatorului
				const companie = this.genValues(companyIdData, parseInt(polite['companie'][i]))
				if (!companie){
					messages.push(
						`Tabela Polita: Nu sunt valide datele din cîmpul companie - rândul (${
							i + 1
						})`,
					)
				}
	
			}
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

		if ('idPolita' in rbns) {
			rbns['idPolita'].forEach((element, index) => {
				if (element === null) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este completat câmpul idPolita - rândul (${
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

			///HERE Verificam daca sunt (')
			rbns['idDosar'].forEach(async (element, index) => {

				if (element.includes("'")) {
					this.errorMessages.push(
						`Tabela RBNS: Caracterul (') - nu poate fi procesat, câmpul idDosar - rândul ${index + 1}`
					)
				}

				if (rbns['LEILiderReasig'][index] && rbns['LEILiderReasig'][index].includes("'")) {
					this.errorMessages.push(
						`Tabela RBNS: Caracterul (') - nu poate fi procesat, câmpul LEILiderReasig - rândul ${index + 1}`
					)
				}

			})

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
			this.errorMessages.push(`Tabela RBNS:  Nu a fost identificata coloana idPolita. Verificați dacă denumirile coloanelor 
			și structura documentului este conform ghidului!`)
			return this.errorMessages
		}

		for (let i = 0; i < rbns['idPolita'].length; i++) {
			// verifica daca moneda este conform nomenclatorului
			const monedaDosar = this.genValues(curencyTypeIdData, rbns['moneda dosar'][i])
			if (!monedaDosar){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din cîmpul moneda dosar - rândul (${
						i + 1
					})`,
				)
			}
			// verifica daca tip dauna este conform nomenclatorului
			const tipDauna = this.genValues(indemnityTypeIdData, rbns['tipDauna'][i])
			if (!tipDauna){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din cîmpul tipDauna - rândul (${
						i + 1
					})`,
				)
			}
			// verifica daca tipBeneficiar este conform nomenclatorului
				const tipBeneficiar = this.genValues(bineficiarIdData, parseInt(rbns['tipBeneficiar'][i]))
				if (!tipBeneficiar){
					this.errorMessages.push(
						`Tabela RBNS: Nu sunt valide datele din cîmpul tipBeneficiar - rândul (${
							i + 1
					})`,
				)}
			
			// verifica daca taraEveniment este conform nomenclatorului
			const taraEveniment = this.genValues(countryIdData, rbns['taraEveniment'][i])
			if (!taraEveniment){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din cîmpul taraEveniment - rândul (${
						i + 1
					})`,
				)
			}

			// verifica daca id companie este conform nomenclatorului
			const companie = this.genValues(companyIdData, parseInt(rbns['companie'][i]))
			if (!companie){
				this.errorMessages.push(
					`Tabela RBNS: Nu sunt valide datele din cîmpul companie - rândul (${
						i + 1
					})`,
				)
			}

		}
		// Aici daca facem return atunci se afiseaza doar RBNS
		//return this.errorMessages
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
			'CompanyID'
		)
		

		if ('idPolita' in plati) {
			plati['idPolita'].forEach((element, index) => {
				if (element === null) {
					this.errorMessages.push(
						`Tabela Plati: Nu este completat câmpul idPolita - rândul (${
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

			///HERE Verificam daca sunt (')
			plati['idDosar'].forEach(async (element, index) => {
				if (element.includes("'")) {
					this.errorMessages.push(
						`Tabela Plati: Caracterul (') - nu poate fi procesat, câmpul idDosar - rândul ${index + 1}`
					)
				}
				if (plati['LEILiderReasig'][index] && plati['LEILiderReasig'][index].includes("'")) {
					this.errorMessages.push(
						`Tabela Plati: Caracterul (') - nu poate fi procesat, câmpul LEILiderReasig - rândul ${index + 1}`
					)
				}
			})	

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
			this.errorMessages.push(`Tabela Plati:  Nu a fost identificata coloana idPolita. Verificați dacă denumirile coloanelor 
			și structura documentului este conform ghidului!`)
			return this.errorMessages
		}

		for (let i = 0; i < plati['idPolita'].length; i++) {

			// verifica daca moneda este conform nomenclatorului
			const moneda = this.genValues(curencyIdData, plati['moneda'][i])
			if (!moneda){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din cîmpul moneda - rândul (${
						i + 1
					})`,
				)
			}
			// verifica daca tip dauna este conform nomenclatorului
			const tipDauna = this.genValues(indemnityTypeIdData, plati['tipDauna'][i])
			if (!tipDauna){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din cîmpul tipDauna - rândul (${
						i + 1
					})`,
				)
			}
			// verifica daca tipBeneficiar este conform nomenclatorului
			const tipBeneficiar = this.genValues(bineficiarIdData, parseInt(plati['tipBeneficiar'][i]))
			if (!tipBeneficiar){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din cîmpul tipBeneficiar - rândul (${
						i + 1
				})`,
			)}
			
			// verifica daca taraEveniment este conform nomenclatorului
			const taraEveniment = this.genValues(countryIdData, plati['taraEveniment'][i])
			if (!taraEveniment){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din cîmpul taraEveniment - rândul (${
						i + 1
					})`,
				)
			}

			// verifica daca id companie este conform nomenclatorului
			const companie = this.genValues(companyIdData, parseInt(plati['companie'][i]))
			if (!companie){
				this.errorMessages.push(
					`Tabela Plati: Nu sunt valide datele din cîmpul companie - rândul (${
						i + 1
					})`,
				)
			}

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

	checkID  = (checkTab, politeTab, tabName, Messages, procentStep) => {

		return new Promise(resolve => {
		  function help(i, Messages) {
			let procentStat = ((i * 100)/checkTab.length).toFixed()
			if (procentStat > procentStep){
				console.log(`Check ID in ${tabName} - ${procentStat}%`)
				procentStep += 1
			}
			if (i == checkTab.length) {
			  return resolve(Messages);
			}
		
			let testCheck = politeTab.includes(checkTab[i])
		
			if (testCheck === false) {
				Messages.push(
					`Tabela ${tabName}: idPolita nu există în tabela Polite - rândul (${
						i + 1
					})`,
				);
			}
		
			setImmediate(help.bind(null, i + 1, Messages));
		  }
		
		  help(0, Messages);  
		})
		
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
	createInsurancePolicy = async (polite, packageID) => {
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
			
			let procentStep = 0
			const columName = ["idPolita", "ClasaRisc", "Produs", "internalMTPLid", "din", "dout", "PBSM", "PBS", "PBA", "moneda", "zonaDeplasare", "vizaLocUtil", "tipVeh", "tipVeh2", "IDN", "nrAuto", "BM", "pfPJ", "varstaPF", "companie", "Salei", "SaMoneda", "CotaReasig", "LEILiderReasig", "Comision", "ChAdmin"]
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
				) + "'" : "'" + insuranceZoneIdData["99"] + "'";
				
				countryCodeId = await this.checkData(
					countryCodeIdData,
					polite['vizaLocUtil'][i].split('-')[0],
				)
				
				if (polite['ClasaRisc'][i].includes('RCA') && polite['BM'][i]) {
					bmId = "'" + await this.checkData(bmIdData, polite['BM'][i]) + "'"
				} else if (!polite['ClasaRisc'][i].includes('RCA')) {
					bmId = polite['BM'][i] ? "'" + await this.checkData(bmIdData, polite['BM'][i]) + "'": "'" + bmIdData["8888"] + "'";
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
                        "CreationDateTimeRow",
						"PackageID"
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
                        '${this.date}',
						'${packageID}'
                    );
                `
				
				let procentStat = ((i * 100)/polite['idPolita'].length).toFixed()
				if (procentStat > procentStep){
					console.log(`Load Polite Data - ${procentStat}%`)
					procentStep += 1
				}
	
				await pool.query(query)
				
				columName.forEach(element => polite[element][i] = '');

			}
		} catch (e) {
			this.errorMessages.push(`Tabela polite: ${e.message}`)
			console.log(e)
			throw new Error()
		}
	}
	
	createInsurancePolicyRBNS = async (rbns, packageID) => {
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
			let procentStep = 0
			const columName = ["idPolita", "idDosar", "ClasaRisc", "dataEveniment", "dataRaport", "miscareDataRaport", "moneda dosar", "tipDauna", "tipBeneficiar", "instanta", "taraEveniment", "companie", "DataRefuz", "CotaReasig", "LEILiderReasig", "ChAdmin"]
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
                        "CreationDateTimeRow",
						"PackageID"
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
                        '${this.date}',
						'${packageID}'
                    )
                `
				let procentStat = ((i * 100)/rbns['idPolita'].length).toFixed()
				if (procentStat > procentStep){
					console.log(`Load RBNS Data - ${procentStat}%`)
					procentStep += 1
				}
	
				await pool.query(query)	

				columName.forEach(element => rbns[element][i] = '');
			}
		} catch (e) {
			this.errorMessages.push('Tabela RBNS: ' + e.message)
			console.log(e)
			throw new Error()
		}
	}

	createInsurancePolicyIndemnity = async (insurance, packageID) => {
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
			let procentStep = 0
			const columName = ["idPolita", "idDosar", "ClasaRisc", "dataEveniment", "dataRaport", "miscareDataRaport", "moneda", "tipDauna", "tipBeneficiar", "instanta", "taraEveniment", "companie", "DataRefuz", "CotaReasig", "LEILiderReasig", "ChAdmin"]
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
                        "CreationDateTimeRow",
						"PackageID"
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
                        '${this.date}',
						'${packageID}'
                    )
                `

				let procentStat = ((i * 100)/insurance['idPolita'].length).toFixed()
				if (procentStat > procentStep){
					console.log(`Load Plati Data - ${procentStat}%`)
					procentStep += 1
				}

				await pool.query(query)

				columName.forEach(element => insurance[element][i] = '');
			}
		} catch (e) {
			this.errorMessages.push('Tabela plati: ' + e.message)
			console.log(e)
			throw new Error()
		}
	}

	saveData = async (data) => {
		try {
			const packageID = uuid4()
			const fileName = this.clientFile.includes('/') ? 
				this.clientFile.split('---')[0].split("/").slice(-1)[0] : 
				this.clientFile.split('---')[0].split("\\").slice(-1)[0]

			await pool.query('BEGIN')
			
			await this.createInsurancePolicy(data['polite'], packageID)
			data['rbns']['idPolita'] ? await this.createInsurancePolicyRBNS(data['rbns'], packageID) : null
			data['plati']['idPolita'] ? await this.createInsurancePolicyIndemnity(data['plati'], packageID) : null

			console.log('Trecut')
			let query = `
            INSERT INTO public."PackageLoaded"(
                "Id", "UserId", "DateTime", "TotalPolicies", "TotalRbns", "TotalPayments", "FileHash", "FileName")
                VALUES (
                '${packageID}',
                '${this.user.id}',
                '${this.date}',
                '${data['polite']['idPolita'].length}',
                '${data['rbns']['idPolita'] ? data['rbns']['idPolita'].length : 0}',
                '${data['plati']['idPolita'] ? data['plati']['idPolita'].length : 0}',
				'${this.fileHashValue}',
				'${fileName.includes("'") ? fileName.replace(/'/g, '"') : fileName}'
                );`

			await pool.query(query)
			await pool.query('COMMIT')
		} catch (e) {
			await pool.query('ROLLBACK')

			console.log(e)
		}
	}

	showEror = (errors, stade) => {
		if (errors.length > 1500){
			errors.splice(0, 0, `Verificare etapa ${stade} din 3: Au fost identificate ${errors.length} erori...`)
			errors.splice(1, 0, "Primele 1500 de erori:")
			return errors.slice(0, 1500)
		} else {
			errors.splice(0, 0, `Verificare etapa ${stade} din 3: Au fost identificate ${errors.length} erori...`)
			return errors
		}
	}

	verifyData = async (data) => {
		// Validare corectitudine date introdus
		this.errorMessages = await this.validatePolite(data.polite, this.errorMessages)
		
		if (data['rbns']['idPolita'] != undefined) {
			await this.validateRbns(data.rbns)
		} 
		
		if (data['plati']['idPolita'] != undefined) {
			await this.validatePlati(data.plati)
		}
		// Afisez in consola cite erori sau identificat dupa validarea corectitudinii datelor
		console.log(`Validare Erors: ${this.errorMessages.length}`)

		// Afiseaza in consolo cita memorie utilizeaza programul in acest moment de tip
		const used = process.memoryUsage().heapUsed / 1024 / 1024;
		console.log(`The script now uses approximately ${Math.round(used * 100) / 100} MB`);

		// Show Error
		if (this.errorMessages.length) {
			let stade = 1
			return await this.showEror(this.errorMessages, stade)
		}
		
		//Verificam Id din RBNS
		if (data['rbns']['idPolita']){
			if(data.rbns['idPolita']){
				console.log("+- Check RBNS ID")
				let procentStep = 0
				await this.checkID(data.rbns['idPolita'], data.polite['idPolita'], 'RBNS', this.errorMessages, procentStep).then((messages) => {
					console.log('FINISH')
					this.errorMessages = messages;
				  })
				
			} else {
				console.log("Nu a fost identificata coloana idPolita in tabelul RBNS")
				this.errorMessages.push("Lipseste coloana idPolita in tabelul RBNS sau a fost definită incorect (verificați ghidul)")
			}
		}
		

		// Afisez in consola cite erori sau identificat dupa verificarea ID in RBNS
		console.log(`ID-RBNS Erors: ${this.errorMessages.length}`)

		// Show Error
		if (this.errorMessages.length) {
			let stade = 2
			return await this.showEror(this.errorMessages, stade)
		}
		
		// Verificam ID din polite 
		if (data['plati']['idPolita']){
			if(data.plati['idPolita']){
				console.log("+- Check Plati ID")
				let procentStep = 0
				await this.checkID(data.plati['idPolita'], data.polite['idPolita'], 'Plati', this.errorMessages, procentStep).then((messages) => {
					this.errorMessages = messages;
				  })
			} else {
				console.log("Nu a fost identificata coloana idPolita in tabelul Plati")
				this.errorMessages.push("Lipseste coloana idPolita in tabelul Plati sau a fost definită incorect (verificați ghidul)")
			}
		}
		// Afisez in consola cite erori sau identificat dupa verificarea ID in Plati
		console.log(`ID-Plati Erors: ${this.errorMessages.length}`)

		// Show Error
		if (this.errorMessages.length) {
			let stade = 3
			return await this.showEror(this.errorMessages, stade)
		}
		
		// Se salveaza datele in BD
		console.log("+- Now save data")
		await this.saveData(data)

		// Show Error
		if (this.errorMessages.length) {
			let stade = 3
			return await this.showEror(this.errorMessages, stade)
		}

		// Salvam loguri ca packetul a fost incarcat
		fs.appendFile('companysucces.txt', `${this.clientFile}\n`, function (err) {
			if (err) throw err;
			console.log('File Updated!');
		});

		return ['Success']
	}
}

module.exports = XlsxParser
