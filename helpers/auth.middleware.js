const jwt = require('jsonwebtoken')
const User = require('../models/user.model')

exports.loggedIn = async (req, res, next) => {
    let token = req.header('Authorization')

    if (!token) {
        return res.status(401).send({
            status: 'failure',
            message: 'Access deny',
        })
    }

    try {
        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length).trimLeft()
        }

        const verified = await jwt.verify(token, process.env.JWT_SECRET)

        if (!(await User.exists(verified.id))) {
            return res.status(401).send({
                status: false,
                message: 'No valid user!',
            })
        }

        req.user = verified
        next()
    } catch (e) {
        console.log(e)
        return res.status(500).send({
            status: false,
            message: 'Something wrong',
        })
    }
}
exports.adminOnly = async (req, res, next) => {
    if (req.user.role !== 'Admin') {
        return res.status(401).send({
            status: false,
            message: 'No acces to this rute of non admin users',
        })
    }

    next()
}
