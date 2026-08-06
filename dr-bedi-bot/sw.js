// If using static folder
app.use(express.static('public'));

// Or explicitly route it
app.get('/sw.js', (req, res) => {
    res.sendFile(__path.join(__dirname, 'public', 'sw.js'));
});