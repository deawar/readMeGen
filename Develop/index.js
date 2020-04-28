/*
-Get user input
-Make API request to GitHub API
-Email and profile image
-Populate Readme.medium

*/
//const axios = require('axios');
//const dotenv = require('dotenv');
//const electron = require('electron');
//const electronHtmlTo = require('electron-html-to');
const inquirer = require('inquirer');
const fs = require('fs');
//const open = require('open');
const questions = [
  {
    type: "input",
    message: "What is your GitHub username?",
    name: "username"
  },
  {
    type: "input",
    message: "What is your Public GitHub Email?",
    name: "email"
  },
  {
    type: "input",
    message: "What is your GitHub Project Name?",
    name: "projectName"
  }
];

inquirer
  .prompt(questions)
  .then(answers => {
    // Use user feedback for... whatever!!
    console.log("Hello world!")
  })
  .catch(error => {
    if (error.isTtyError) {
      // Prompt couldn't be rendered in the current environment
    } else {
      // Something else when wrong
    }
  });

function writeToFile (data, filename) {
  const header = `# ${projectTitle} 

    ![https://img.shields.io/badge/Node.js-v12.16.2-brightgreen] ![https://img.shields.io/badge/Electron-v.6.14.4-blue]
    ${projectDescription}
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mini Project 40</title>
    </head>
    <body>
        <div class="container">`;
  fs.writeFile(filename + ".html", header + data, function (err) {
    if (err) {
      return console.log(err);
    }
  });
}

function init() {

}

init();