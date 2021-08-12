const {pool} = require('./db')
const bcrypt = require('bcryptjs')
const {v4: uuid4} = require('uuid')

const User = function (user) {
    if (user.id !== 'undefined') {
        this.id = user.id
    }

    this.username = user.username
    this.password = user.password
}

User.login = async function (username) {
    try {
        let user = await pool.query(
            `SELECT "User"."Id", "UserName", "Password", "FirstName", "LastName", "UserRoleId", "UserEmail", "CompanyId", "Name" AS "role"
                FROM "${process.env.DB_NAME}".public."User" INNER JOIN public."UserRoles" ON "UserRoleId" = "UserRoles"."Id"
                WHERE "UserName" = '${username}'`
        )

        if (!user.rows.length) {
            return undefined
        }

        let company = await pool.query(`SELECT "CompanyName" FROM "${process.env.DB_NAME}".public."Company"
            WHERE "CompanyID" = ${user.rows[0]['CompanyId']}
        `)

        return {
            id: user.rows[0]['Id'],
            username: user.rows[0]['UserName'],
            password: user.rows[0]['Password'],
            firstName: user.rows[0]['FirstName'],
            lastName: user.rows[0]['LastName'],
            userEmail: user.rows[0]['UserEmail'],
            company: company.rows[0]['CompanyName'],
            role: user.rows[0]['role'],
        }
    } catch (e) {
        console.log(e)
    }
}

User.exists = async function (id) {
    try {
        let user = await pool.query(
            `SELECT * FROM "${process.env.DB_NAME}".public."User" WHERE "Id" = '${id}'`
        )

        if (!user.rows.length) {
            return false
        }

        return true
    } catch (e) {
        return false
    }
}

User.getRole = async (role) => {
    let query = `
        SELECT "Id" FROM "${process.env.DB_NAME}".public."UserRoles"
        WHERE "Name" = '${role}';
    `

    let id = await pool.query(query)

    if (id.rows.length) {
        return id.rows[0]['Id']
    }

    return undefined
}

User.register = async (newUser) => {
    try {
        const salt = await bcrypt.genSalt(10)
        const hasPassword = await bcrypt.hash(newUser.password, salt)
        const uuid = await uuid4()
        const roleId = await User.getRole(newUser.role)

        if (!roleId) {
            return undefined
        }

        let query = `INSERT INTO "${
            process.env.DB_NAME
        }".public."User" ("Id", "UserName", "Password", "FirstName", "LastName", "UserRoleId", "UserEmail", "CompanyId")
            VALUES (
                '${uuid}',
                '${newUser.username}',
                '${hasPassword}',
                '${newUser.firstName}',
                '${newUser.lastName}',
                '${roleId}',
                '${newUser.userEmail}',
                ${newUser.company ? newUser.company : 99}
            )
        `

        await pool.query(query)
        return {
            uuid: uuid,
            username: newUser.username,
            fistName: newUser.firstName,
            lastName: newUser.lastName,
            userEmail: newUser.userEmail,
        }
    } catch (e) {
        console.log(e.message)
        return undefined
    }
}

User.getCompany = async () => {
    try {
        let query

        query = `
            SELECT "CompanyID", "CompanyName"
            FROM "${process.env.DB_NAME}".public."Company"
        `

        return await pool.query(query)
    } catch (e) {
        throw e
    }
}

User.changePass = async (id, newPassword) => {
    const salt = await bcrypt.genSalt(10)
    console.log(newPassword)
    const hasPassword = await bcrypt.hash(newPassword, salt)

    let query = `
        UPDATE public."User"
            SET "Password"= '${hasPassword}'
            WHERE "Id" = '${id}';
    `

    let response = await pool.query(query)

    if (!response) {
        return false
    }

    return true
}

User.stats = async (id) => {
    
    let query = `SELECT "CompanyId" FROM public."User"
        INNER JOIN "Company" ON "Company"."CompanyID"="User"."CompanyId" WHERE "Id"='${id}'`
    
    let response = await pool.query(query)

    query = `SELECT "PackageLoaded"."Id", CONCAT("FirstName",' ',"LastName"), "DateTime", "TotalPolicies", "TotalRbns", "TotalPayments"
	        FROM public."PackageLoaded"
			INNER JOIN "User" ON "User"."Id"="PackageLoaded"."UserId"
		WHERE "CompanyId"='${response.rows[0].CompanyId}'`

    response = await pool.query(query)

    if (!response) {
        return undefined
    }

    return response.rows
}

User.logLogin = async ({id, date}) => {
    let query = `
    INSERT INTO public."UserLogin"(
        "Id", "Userid", "LoginTime")
        VALUES (
        '${uuid4()}',
        '${id}',
        '${date}'
        );
    `

    await pool.query(query)
}

module.exports = User
