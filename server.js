const express = require('express')
const bodyParser = require('body-parser')
const busboy = require('connect-busboy')
// const fileUpload = require('express-fileupload')
const cors = require('cors')
const morgan = require('morgan')
const path = require('path')

const env = require('dotenv')

const authRoute = require('./routes/auth')
const uploadRoute = require('./routes/upload')

env.config()

const app = express()

app.use(express.static(path.join(__dirname, 'public')))

// // Enable uploading files
// app.use(
//     fileUpload({
//         createParentPath: true,
//     })
// )

// Add other middlewares
app.use(cors())
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())
app.use(busboy({ highWaterMark: 4 * 1024 * 1024 }))
app.use(morgan('dev'))

// Api Routes
app.use('/api/v1/users', authRoute)
app.use('/api/v1/upload', uploadRoute)

// Setting app port
const port = process.env.PORT || 3000
const host = process.env.HOST || 'localhost'

app.listen(port, host, () => {
    console.log('Server listening on port: ', port)
})
