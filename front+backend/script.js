require('dotenv').config();
const express = require('express');
const {google} = require('googleapis');
const dayjs = require('dayjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
var customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const app = express();

app.use(session({
    genid: (req) => {
        return uuidv4(); // Use the v4 function to generate unique session IDs
    },
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'))

// Define a function to fetch rowData and currentTimeFull
async function fetchData() {
    const currentTimeFull = new Date().toLocaleString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    });

    const auth = new google.auth.GoogleAuth({

        credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escape sequences
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`,
        universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
    },
    scopes: "https://www.googleapis.com/auth/spreadsheets"
    });

    const client = await  auth.getClient();

    const googleSheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = "1xe6YfuuSxe_1a0kM0U7fRPE364A39oOZys6aoFHHk9w";

    const metaData = await googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
    });

    const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "Sheet1",
    });  

    // array containing row-wise data from index 1 to end (not starting from 0 as 1st row is headers)
    const rowData = getRows.data.values.slice(1)
    const currentTime = currentTimeFull.split(', ')[2]

    return { rowData, currentTimeFull, currentTime };
}

// Route for rendering the index page
app.get('/', async (req, res) => {
    const { rowData, currentTimeFull, currentTime } = await fetchData();

    res.render('index.ejs', {
        curr: nextBus(rowDataSelector(rowData, currentTimeFull), currentTime, 'nila'),
        curr2: nextBus(rowDataSelector(rowData, currentTimeFull), currentTime, 'sahyadri')
    });

});

app.get('/next', async(req, res) => {
    const { rowData, currentTimeFull, currentTime } = await fetchData();
    // const selectedRowData = rowDataSelector(rowData, currentTimeFull); // If you want to print only mon-fri or sat or  sun timtable then use this instead of rowData
    const selectedRowData = rowData; // If you want to print full timetable then use this instead of rowDataSelector(rowData, currentTimeFull)
    req.session.data = selectedRowData;
    res.render('next.ejs' , {data :req.session.data , curr : nextBus(rowDataSelector(rowData, currentTimeFull), currentTime, 'nila'), curr2 : nextBus(rowDataSelector(rowData, currentTimeFull), currentTime, 'sahyadri')}) ;
}) ;

app.post('/getTime', async(req, res) =>{
    const { rowData, currentTimeFull, currentTime } = await fetchData();
    req.session.data = rowData ;
    req.session.currentTime = currentTime ;
    res.redirect('next') ;
    
}) ;

app.listen(5000,()=>{
    console.log("hello");
})


function nextBus(rowsData, compareTimeValue, endpoint) {
    const currTime = dayjs(compareTimeValue)
    for (val in rowsData) {
        if (rowsData[val][2].toLowerCase() === endpoint && dayjs(compareTimeValue, 'hh:mm A').isBefore(dayjs(rowsData[val][0], 'hh:mm A'))) {
                return rowsData[val][0]
        }   
    }
}

function rowDataSelector(rowsData, currDateTime) {
    const instiHolidays = ['Jan 15', 'Jan 26', 'Mar 25', 'Mar 29', 'Apr 11', 'Apr 21']
    const MonFri = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const currDate = currDateTime.split(', ')[1]
    let dayIndex = currDateTime.split(', ')[0]

    // if date is a institute holiday go to saturday timetable
    if (instiHolidays.includes(currDate) && currDateTime.split(', ')[0] !== 'Sun') {
        dayIndex = "Sat"
    }
    
    if (MonFri.includes(dayIndex)) {
        dayIndex = "Mon-Fri"
    }

    let startIndex = -1
    let endIndex = 0
    for (let row = 0; row < rowsData.length; row++) {
        if (rowsData[row][4] === dayIndex) {
            if (startIndex === -1) {
                startIndex = row
            } 
            endIndex = row + 1
        }
        else if (endIndex) {
            break
        } 
    }
    return rowsData.slice(startIndex, endIndex)
}


