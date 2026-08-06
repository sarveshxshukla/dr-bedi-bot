app.get('/sw.js', (req, res) => {
    res.sendFile(__dirname + '/sw.js'); // or point to its exact path
});