/*
-Get user input
-Make API request to GitHub API
-Email and profile image
-Populate Readme.medium

*/
const axios = require('axios');
require('dotenv').config()

//const electron = require('electron');
//const electronHtmlTo = require('electron-html-to');
const inquirer = require('inquirer');
const fs = require('fs');
//const open = require('open');
console.log(process.env.SECRET_MESSAGE);
const TOKEN = process.env.TOKEN;

const questions = [
  {
    type: "input",
    message: "Please enter your GitHub username: ",
    name: "username"
  },
  {
    type: "input",
    message: "What is your Project's title?",
    name: "projectTitle"
  },
  {
    type: "input",
    message: "Describe your Project's purpose?",
    name: "description"
  },
  {
    type: "input",
    message: "Do you need a Table of Contents?",
    name: "tableOfContents"
  },
  {
    type: "input",
    message: "How do we Install your project?",
    name: "install"
  },
  {
    type: "input",
    message: "How will we use/run this Project?",
    name: "usage"
  },
  {
    type: "list",
    name: "license",
    message: "GitHub suggest you always add a license to your project. \nWhat License do you want to apply to this Project?",
    choices: ['Apache 2.0', 'GNU AGPLv3', 'GNU GPLv3', 'GPLv3', 'MIT', 'Mozilla Public License 2.0', 'The Unlicense'],
  },
  {
    type: "input",
    message: "Would you like to add Contrubutors?\n(Enter their GitHub usernames separated by commas)",
    name: "contributors"
  },
  {
    type: "input",
    message: "How do you run Tests?",
    name: "tests"
  },

];

const getUsername = async (username) => {
  const gitUrl = `https://api.github.com/users/${username}`; //${TOKEN}
  try{
    const response = await axios({
      method: "get",
      url: gitUrl,
      headers: {
      authorization: `token ${TOKEN}`  
    }})
    console.log(response.data)
    const {login, avatar_url, repos_url, email, name} = response.data;
      const gitInfo = {
        "login": login,
        "avatar_url": avatar_url,
        "repos_url": repos_url,
        "email": email,
        "name" : name
      }; 
      return gitInfo
  }catch(err){
    console.log(err)
    return null
  }
};

const getUserInput = async () => {
  try {
    const input = await inquirer.prompt(questions
      // type: "input",
      // message: "Please enter your GitHub username: ",
      // name: "username"
    );
    // const currentUser = await getUsername(input.username)
    //console.log("In getUserInput: ",currentUser.user)
    writeToFile(input, "readME.md")
  } 
  catch (error){
    console.log("In getUserInput catch error: ",error);
  }
};

const getProjectInfo = async () => {
  try {
    const input = await inquirer.prompt({questions});
  writeToFile(input, "readME.md")
  } 
  catch (error){
  console.log("In getuserProjectInfo catch error: ", error);
  }
}
  
async function writeToFile (data, filename) {
  // console.log(data.projectName)
  const {username, email, projectName, projectUrl, name} = data
  const gitInfo = await getUsername(username); 
  console.log("gitinfo",gitInfo)
  const gitName = !gitInfo ? "Unknown Coder": gitInfo.name;
  const gitEmail = !gitInfo ? "Private Email": gitInfo.email;
  const avatar_url = !gitInfo ? "https://randomwordgenerator.com/picture.php" : gitInfo.avatar_url
  console.log("avatar url",avatar_url)
  const gitProject = await getProjectInfo(projectInfo);
  //const projectTitle = gitProject.projectTitle;



  const header = `# ${projectName}                       [!${avatar_url}] <a href="mailto:${gitEmail}">Email Me</a>
  
      ${projectDescription}
      [![GitHub issues](https://img.shields.io/github/issues/${username}/${projectName}?style=plastic)]({$projectUrl}/issues)
      [![GitHub forks](https://img.shields.io/github/forks/${username}/${projectName}?style=plastic)]({$projectUrl}/network)
      
      ##${descrition}

      ## Table of Contents
      
      * [Installation](#installation)
      * [Usage](#usage)
      * [Credits](#credits)
      * [License](#license)
      
      ## Installation
      ${install}

      ## Usage 
       
      ${usage}
      

      ## Credits

      ${collaborators}

      ## License

      ${license}

      ## Tests
     
      ${test}
      <hr>
      Repo owner is ${gitname}.

      `;
    fs.writeFile(filename, header + data, function (err) {
      if (err) {
        return console.log(err);
      }
  } )
}

function init() {
  getUserInput();
}

init();