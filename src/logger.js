const fs = require('fs');
var logger = {
   log: function(file, words){
        console.log(`[${new Date().toTimeString()}] ${words}`);
        fs.appendFile(file,`[${new Date().toTimeString()}] ${words}\n`,
        function (err) {
          if (err) console.log('could not write to file');
        });
    },
    csv: function(file, words){
        fs.appendFile(file,`${words}\n`,
        function (err) {
          if (err) console.log('could not write to file');
        });
    }
};

module.exports = logger;