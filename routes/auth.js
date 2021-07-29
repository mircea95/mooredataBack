const express = require('express')
const userController = require('../controllers/user.controller')
const {loggedIn, adminOnly} = require('../helpers/auth.middleware')

const router = express.Router()

// Login
router.post('/login', userController.login)

// Register
router.post('/register', loggedIn, adminOnly, userController.register)

// Company List
router.get('/company', loggedIn, userController.getCompany)

// Update password
router.patch('/newPwd', loggedIn, userController.newPassword)

// User Statistics
router.get('/stats', loggedIn, userController.stats)

module.exports = router
