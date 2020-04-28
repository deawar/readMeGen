/*
-Get user input
-Make API request to GitHub API
-Email and profile image
-Populate Readme.medium

*/
const axios = require('axios');
//const dotenv = require('dotenv');
//const electron = require('electron');
//const electronHtmlTo = require('electron-html-to');
const inquirer = require('inquirer');
const fs = require('fs');
//const open = require('open');
console.log(process.env.SECRET_MESSAGE);


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
    
    // console.log(answers)
    // console.log(answers.projectName)
    // const {username, email, projectName} = answers
    // console.log(username, email, projectName)
    writeToFile(answers, "ReadME.md")
  })
  .catch(error => {
    if (error.isTtyError) {
      console.log("Inquierer: unable to save to file: ",error)
      // Prompt couldn't be rendered in the current environment
    } else {
      // Something else when wrong
    }
  });

  const getUsername = async (username) => {

    try{
      console.log(username);
      const gitUrl = `https://api.github.com/users/${username}`
      await axios.get(gitUrl)
          .then(response =>{
            const {login, avatar_url, repos_url, email} = response.data;
            const gitInfo = {
              "login": login,
              "avatar_url": avatar_url,
              "repos_url": repos_url,
              "email": email
            }; 
            return response.avatar_url
            
          }).catch(err =>{
            
            console.log(err)
            return null
          });
    }catch{(err)=>{
      console.log(err)
      return null
    }}

  }
  
  
  
  function writeToFile (data, filename) {
    // console.log(data.projectName)
    const {username, email, projectName} = data
   const avatarUrl = getUsername(username);  
   console.log(avatarUrl)
    
    const header = `# ${projectName} 
    
        ![https://img.shields.io/badge/Node.js-v12.16.2-brightgreen] ![https://img.shields.io/badge/Electron-v.6.14.4-blue]
        ${projectDescription}
        
        `;
      fs.writeFile(filename + ".html", header + data, function (err) {
        if (err) {
          return console.log(err);
        }
    } )
}

function init() {

}

init();