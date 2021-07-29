const xlsx = require('node-xlsx')
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

	generateDataModel = async (fileName) => {
		const workSheets = xlsx.parse(fileName, {
			raw: true,
		})

		for (let i = 0; i < workSheets.length; i++) {
			switch (workSheets[i].name) {
				case 'Plati':
					this.dataModel.plati = this.generateData(workSheets[i].data)
					break
				case 'Polite':
					this.dataModel.polite = this.generateData(workSheets[i].data)
					break
				case 'RBNS':
					this.dataModel.rbns = this.generateData(workSheets[i].data)
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

	politaExists = async (politaName) => {
		let query = `SELECT "PolicyId" FROM public."InsurancePolicy" WHERE "PolicyName" = '${politaName}'`

		let response = await pool.query(query)

		return !!response.rows.length
	}

	validatePolite = async (polite, messages) => {
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

			polite['idPolita'].forEach(async (element, index) => {
				// if (await this.politaExists(element)) {
				// 	messages.push(
				// 		`Tabela Polita: Polita cu asa id deja exista in baza de date - randul ${
				// 			index + 1
				// 		}`,
				// 	)
				// }

				if (!polite['BM'][index] && polite['ClasaRisc'][index].includes('RCA')) {
					messages.push(
						`Tabela Polite: Nu este valid tipul datelor din campul 'BM' randul ${index}`
					)
				}
			})

			polite['Salei'].forEach(async (element, index) => {
				if (!this.isNumeric(element)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'Salei' randul ${
							index + 1
						}`,
					)
				} else if (!(Number(element) > 0)) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'Salei' randul ${
							index + 1
						}`,
					)
				}
			})

			polite['din'].forEach((element, index) => {
				if (!this.isDate(element) || this.isNumeric(element)) {
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
				if (!this.isDate(element) || this.isNumeric(element)) {
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
				if (!this.isNumeric(element) || !element) {
					messages.push(
						`Tabela Polita: Nu este valid tipul datelor in campul 'ChAdmin' randul ${
							index + 1
						}`,
					)
				}
			})
		} else {
			messages.push('Tabela Polita: Lipseste idPolita')
		}

		return messages
	}

	validateRbns = async (rbns) => {
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

			rbns['dataEveniment'].forEach((element, index) => {
				if (!this.isDate(element) || this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'dataEveniment' randul ${
							index + 1
						}`,
					)
				}
			})

			rbns['dataRaport'].forEach((element, index) => {
				if (!this.isDate(element) || this.isNumeric(element)) {
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
				if ((!this.isDate(element) || this.isNumeric(element)) && rbns['DataRefuz'][index]) {
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

				if (element !== 0) {
					if (!rbns['LEILiderReasig'][index]) {
						this.errorMessages.push(
							`Tabela RBNS: Nu este valid tipul datelor in campul 'LEILiderReasig' - randul ${index + 1}`
						)
					}
				}
			})

			rbns['ChAdmin'].forEach((element, index) => {
				if (!this.isNumeric(element) || !element) {
					this.errorMessages.push(
						`Tabela RBNS: Nu este valid tipul datelor in campul 'ChAdmin' randul ${
							index + 1
						}`,
					)
				}
			})
		} else {
			this.errorMessages.push(`Tabela RBNS: Lipseste 'idPolita`)

			return this.errorMessages
		}

		return this.errorMessages
	}

	validatePlati = async (plati) => {
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

			plati['dataEveniment'].forEach((element, index) => {
				if (!this.isDate(element) || this.isNumeric(element)) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'dataEveniment' randul ${
							index + 1
						}`,
					)
				}
			})

			plati['dataRaport'].forEach((element, index) => {
				if (!this.isDate(element) || this.isNumeric(element)) {
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
				if ((!this.isDate(element) || this.isNumeric(element)) && plati['DataRefuz'][index]) {
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

				if (element !== 0) {
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
				if (!this.isNumeric(element) || !element) {
					this.errorMessages.push(
						`Tabela Plati: Nu este valid tipul datelor in campul 'ChAdmin' randul ${
							index + 1
						}`,
					)
				}
			})
		} else {
			this.errorMessages.push(`Tabela Plati: Lipseste 'idPolita`)

			return this.errorMessages
		}

		return this.errorMessages
	}

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

	checkData = async (nomenc, value, index, column) => {
		let values = Object.keys(nomenc).map(function(key){
			return nomenc[key];
		});
		if (value in nomenc) {
			return nomenc[value]
		} else if (values.includes(value)){
			return value
		}

		throw new Error(`Nu sunt valide datele (${column}) - randul (${index + 1})`)
	}

	checkID = async(checkTab, politeTab, tabName, Messages) => {
		
		checkTab['idPolita'].forEach((element, index) => {
			
			let testCheck = politeTab['idPolita'].includes(element)
			
			if (testCheck === false) {
				Messages.push(
					`Tabela ${tabName}: idPolita nu există în tabela Polite - rândul (${
						index + 1
					})`,
				)
			}
		})
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

	createInsurancePolicy = async (polite) => {
		try {
			let policyId
			let riskClassId
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
			
			for (let i = 0; i < polite['idPolita'].length; i++) {
				policyId = await this.uuidCreate(polite['idPolita'][i])
				
				riskClassId = await this.checkData(
					riskClassIdData,
					polite['ClasaRisc'][i],
					i,
					"ClasaRisc",
				)
				
				curencyTypeId = await this.checkData(
					curencyTypeIdData,
					polite['moneda'][i],
					i,
					'moneda',
				)

				curencyTypeId1 = await this.checkData(
					curencyTypeIdData,
					polite['SaMoneda'][i],
					i,
					'SaMoneda',
				)

				insuranceZoneId = polite['zonaDeplasare'][i] ? "'" + await this.checkData(
					insuranceZoneIdData,
					polite['zonaDeplasare'][i],
					i,
					'zonaDeplasare',
				) + "'" : null;
				
				countryCodeId = await this.checkData(
					countryCodeIdData,
					polite['vizaLocUtil'][i].split('-')[0],
					i,
					'vizaLogUtil',
				)
				
				if (polite['ClasaRisc'][i].includes('RCA') && polite['BM'][i]) {
					bmId = "'" + await this.checkData(bmIdData, polite['BM'][i], i, 'BM') + "'"
				} else if (!polite['ClasaRisc'][i].includes('RCA')) {
					bmId = polite['BM'][i] ? "'" + await this.checkData(bmIdData, polite['BM'][i], i, 'BM') + "'": null;
				} else {
					bmId = "'" + await this.checkData(bmIdData, polite['BM'][i], i, 'BM') + "'"
				}

				companyId = await this.checkData(
					companyIdData,
					polite['companie'][i],
					i,
					'companie',
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
                        '${polite['din'][i]}',
                        '${polite['dout'][i]}',
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
			let curencyTypeId
			let indemnityTypeId
			let bineficiarId
			let countryId
			let companyId
			
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

			for (let i = 0; i < rbns['idPolita'].length; i++) {
				policyID = await this.getUuid(
					rbns['idPolita'][i]
				)

				curencyTypeId = await this.checkData(
					curencyTypeIdData,
					rbns['moneda dosar'][i],
					i,
					'moneda dosar',
				)
				indemnityTypeId = await this.checkData(
					indemnityTypeIdData,
					rbns['tipDauna'][i],
					i,
					'tipDauna',
				)

				bineficiarId = await this.checkData(
					bineficiarIdData,
					rbns['tipBeneficiar'][i],
					i,
					'tipBeneficiar',
				)
				countryId = await this.checkData(
					countryIdData,
					rbns['taraEveniment'][i],
					i,
					'taraEveniment',
				)
				companyId = await this.checkData(
					companyIdData,
					rbns['companie'][i],
					i,
					'companie'
				)

				let dataRefuz = rbns['DataRefuz'][i] ? "'" + rbns['DataRefuz'][i] + "'": null 
				

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
			let curencyId
			let indemnityTypeId
			let bineficiarId
			let countryId
			let companyId
			
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

			for (let i = 0; i < insurance['idPolita'].length; i++) {
				policyId = await this.getUuid(
					insurance['idPolita'][i]
				)
				curencyId = await this.checkData(
					curencyIdData,
					insurance['moneda'][i],
					i,
					'moneda',
				)
				indemnityTypeId = await this.checkData(
					indemnityTypeIdData,
					insurance['tipDauna'][i],
					i,
					'tipDauna',
				)
				bineficiarId = await this.checkData(
					bineficiarIdData,
					insurance['tipBeneficiar'][i],
					i,
					'tipBeneficiar',
				)
				countryId = await this.checkData(
					countryIdData,
					insurance['taraEveniment'][i],
					i,
					'taraEveniment',
				)
				companyId = await this.checkData(
					companyIdData,
					insurance['companie'][i],
					i,
					'companie'
				)

				let dataRefuz = insurance['DataRefuz'][i] ? "'" + insurance['DataRefuz'][i] + "'": null 


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
                        '${insurance['dataEveniment'][i]}',
                        '${insurance['dataRaport'][i]}',
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
			await pool.query('BEGIN')
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
			await pool.query('COMMIT')
		} catch (e) {
			await pool.query('ROLLBACK')

			console.log(e)
		}
	}

	verifyData = async (data) => {
		this.errorMessages = await this.validatePolite(data.polite, this.errorMessages)
		await this.validateRbns(data.rbns)
		await this.validatePlati(data.plati)
		if (this.errorMessages.length) {
			return this.errorMessages
		}
		//
		this.errorMessages = await this.checkID(data.rbns, data.polite, 'RBNS', this.errorMessages)
		if (this.errorMessages.length) {
			return this.errorMessages
		}
		//
		this.errorMessages = await this.checkID(data.plati, data.polite, 'Plati', this.errorMessages)
		if (this.errorMessages.length) {
			return this.errorMessages
		}
		//

		await this.saveData(data)

		if (this.errorMessages.length) {
			return this.errorMessages
		}

		return ['Success']
	}
}

module.exports = XlsxParser
