const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const pool = require('../models/db')

exports.login = async (req, res) => {
    try {
        if (!req.body.username || !req.body.password) {
            return res.status(400).send({
                status: 'failure',
                message: 'No specified username or password',
            })
        }

        const user = await User.login(req.body.username.trim())

        if (user) {
            const validPass = await bcrypt.compare(req.body.password.trim(), user.password)
            // const validPass = req.body.password === user.password

            if (!validPass) {
                return res.status(400).send({
                    status: 'failure',
                    message: 'Wrong password',
                })
            }

            const token = jwt.sign(
                {
                    ...user,
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '1d',
                }
            )

            let today = new Date()

            let date = `${today.getFullYear()}-${
                today.getMonth() + 1
            }-${today.getDate()} ${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`

            User.logLogin({
                id: user.id,
                date: date,
            })

            return res.header('auth-token', token).send({
                token: token,
                user: user,
            })
        }

        return res.status(400).send({
            status: 'failure',
            message: 'No such user in database',
        })
    } catch (e) {
        console.log(e)
        return res.status(500).send({
            status: false,
            message: 'Server error',
        })
    }
}

exports.register = async (req, res) => {
    if (
        !req.body.username ||
        !req.body.password ||
        !req.body.firstName ||
        !req.body.lastName ||
        !req.body.role ||
        !req.body.userEmail
    ) {
        return res.status(400).send({
            status: false,
            message: 'Not specified full data',
        })
    }

    const user = await User.login(req.body.username)

    if (user) {
        return res.status(400).send({
            status: false,
            message: 'User with this username already exists',
        })
    }

    let newUser = await User.register({
        ...req.body,
    })

    if (!newUser) {
        return res.status(500).send({
            status: false,
            message: 'Something wrong',
        })
    }

    return res.status(200).send({
        status: true,
        message: 'Successfully created a new user',
        data: {
            ...newUser,
        },
    })
}

exports.getCompany = async (req, res) => {
    try {
        const existing = await User.getCompany()

        if (existing.rows.length) {
            return res.status(200).send({
                status: true,
                data: existing.rows,
            })
        } else {
            return res.status(404).send({
                status: false,
                data: 'No company',
            })
        }
    } catch (e) {
        console.log(e.message)
        return res.status(404).send({
            status: false,
            data: 'No company',
        })
    }
}

exports.newPassword = async (req, res) => {
    if (!req.body.id || !req.body.oldPassword || !req.body.newPassword) {
        return res.status(400).send({
            status: false,
            message: 'Not specified full data',
        })
    }

    const user = await User.login(req.body.username)

    if (!user) {
        return res.status(400).send({
            status: false,
            message: 'not existing user',
        })
    }

    const validPass = await bcrypt.compare(req.body.oldPassword, user.password)
    // const validPass = req.body.password === user.password

    if (!validPass) {
        return res.status(401).send({
            status: false,
            message: 'Wrong old password',
        })
    }

    let newPass = User.changePass(req.body.id, req.body.newPassword)

    if (!newPass) {
        return res.status(500).send({
            status: false,
            message: 'Something wrong',
        })
    }

    return res.status(200).send({
        status: true,
        message: 'Successfully password was changed',
        data: {
            ...newPass,
        },
    })
}

exports.stats = async (req, res) => {
    let response = await User.stats(req.user.id)

    res.send({
        status: response ? true : false,
        data: response,
    })
}
