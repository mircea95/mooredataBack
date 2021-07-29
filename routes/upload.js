const express = require('express')
const fileController = require('../controllers/file.controller')
const {loggedIn} = require('../helpers/auth.middleware')

const router = express.Router()

// Upload a file
router.post('/file', loggedIn, fileController.uploadFile)

module.exports = router
