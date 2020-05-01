/*
-Get user input
-Make API request to GitHub API
-Email and profile image
-Populate Readme.medium

*/
const axios = require('axios');
require('dotenv').config();
const figlet = require("figlet");
const chalk = require("chalk");
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
    message: "Description of yourProject's purpose?",
    name: "description"
  },
  {
    type: "confirm",
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
    message: "Would you like to add Contrubutors or Tutorials?\n(Enter their GitHub usernames separated by commas)",
    name: "contributors"
  },
  {
    type: "input",
    message: "Would you like to add additional Modules requirements?\n(Enter their npmjs names separated by commas)",
    name: "modules"
  },
  {
    type: "input",
    message: "How do you run Tests?",
    name: "tests"
  },
  {
    type: "confirm",
    message: "Would you like to include the Contrubutor Covenant in your ReadMe?",
    name: "conCovenant"
  }

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
    const {html_url, login, avatar_url, repos_url, email, name, bio} = response.data;
      const gitInfo = {
        "html_url": html_url,
        "login": login,
        "avatar_url": avatar_url,
        "repos_url": repos_url,
        "email": email,
        "name" : name,
        "bio": bio
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
    );
    writeToFile(input, "readME.md")
  } 
  catch (error){
    console.log("In getUserInput catch error: ",error);
  }
};

  
async function writeToFile (data, filename) {
  
  const {username, email, projectUrl, name, conCovenant} = data
  const gitInfo = await getUsername(username); 
  console.log("Line 125 gitinfo: ",gitInfo)
  
    //console.log("Sorry no data retrieved!", error);
    const avatar_url = !gitInfo ? "https://randomwordgenerator.com/picture.php" : gitInfo.avatar_url
  
    const gitName = !gitInfo.name ? username : gitInfo.name;
    const gitEmail = gitInfo.email;
    let tableOfContents = data.tableOfContents;
    let projectTitle = data.projectTitle;
    let projectDescription = data.description;
    let install = data.install;
    let usage = data.usage;
    let collaborators = !data.contributors ? "None Currently" : data.contributors;
    let license = data.license;
    let urprojectUrl = data.projectUrl;
    //let conCovenant = data.conCovenant;
    let conCovenantBadge = `[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg?style=plastic)](code_of_conduct.md) `;
    if(!tableOfContents){
      tableOfContents = "";
    }
    else{
      tableOfContents = "* [Installation](#installation)  \n";
      tableOfContents = tableOfContents + "* [Usage](#usage)  \n";
      tableOfContents = tableOfContents + "* [Credits](#credits)  \n";  
      tableOfContents = tableOfContents + "* [License](#license)  \n";
    }
    if(!conCovenant){
      conCovenantBadge = "";

    }
    license = "[" +  license + "]" + "(https://github.com/"  + username + "/"+ projectTitle + "/blob/master/LICENSE)"; 
    switch (license) {
      case 'Apache 2.0' :
        license = license + " -A permissive license whose main conditions require preservation of copyright and license notices. Contributors provide an express grant of patent rights. Licensed works, modifications, and larger works may be distributed under different terms and without source code.";
        break;
      case 'GNU AGPLv3' :
        license = license + " -Permissions of this strongest copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights. When a modified version is used to provide a service over a network, the complete source code of the modified version must be made available."; 
        break;
      case 'GNU GPLv3' : 
        license = license + " -Permissions of this strong copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.";
        break;
      case 'GPLv3' : 
        license = license + " -Permissions of this strong copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.";
        break;
      case 'MIT' : 
        license = license + " -A short and simple permissive license with conditions only requiring preservation of copyright and license notices. Licensed works, modifications, and larger works may be distributed under different terms and without source code. ";
        break;
      case 'Mozilla Public License 2.0' : 
        license = license + " -Permissions of this weak copyleft license are conditioned on making available source code of licensed files and modifications of those files under the same license (or in certain cases, one of the GNU licenses). Copyright and license notices must be preserved. Contributors provide an express grant of patent rights. However, a larger work using the licensed work may be distributed under different terms and without source code for files added in the larger work.";
        break;
      default :  //'The Unlicense' 
        license = license + " -A license with no conditions whatsoever which dedicates works to the public domain. Unlicensed works, modifications, and larger works may be distributed under different terms and without source code.";
    }
    
    const test = data.tests;


    console.log("avatar url:",avatar_url);
    console.log("data: ",data);
    console.log ('Project Title :', projectTitle);
    
    //build the file
    let header = "# " + projectTitle + ' \n '; 
    // ${projectDescription}
    header = header + "## Badges  \n";
    header = header + `[![GitHub issues](https://img.shields.io/github/issues/` + username + "/"+ projectTitle + `?style=plastic)](`+ urprojectUrl + `/network)`; //+ "\n";
    header = header + `[![GitHub forks](https://img.shields.io/github/forks/` + username + "/" + projectTitle + `?style=plastic)](` + projectUrl + `/network)`; 
    header = header + conCovenantBadge + "\n";
    header = header + "## Description  " + '\n';
    header = header + '  ' + projectDescription + '  \n';
    header = header + tableOfContents + "  \n";
    header = header + "## Installation  \n";
    header = header + install + " \n";
    header = header + "## Usage  \n";
    header = header + usage + "  \n";
    header = header + "## Credits  \n";
    header = header +  collaborators + " \n ";
    header = header + "## License  \n";
    header = header + license + "  \n";
    
    
    
      // [![GitHub forks](https://img.shields.io/github/forks/${username}/${projectTitle}?style=plastic)]({$projectUrl}/network)
      
    //![node-current](https://img.shields.io/node/v/inquirer?style=plastic)

    //'[![GitHub issues](https://img.shields.io/github/issues/'itsjonkelley/RainChk?style=plastic)](https://github.com/itsjonkelley/RainChk/issues)
      // 
      // ##${projectDescription}

      // ## Table of Contents
      
      // * [Installation](#installation)
      // * [Usage](#usage)
      // * [Credits](#credits)
      // * [License](#license)
      
      // ## Installation
      // ${install}

      // ## Usage 
       
      // ${usage}
      

      // ## Credits

      // ${collaborators}

      // ## License

      // ${license}

      // ## Tests
     
      // ${test}
      // <hr>
      // Repo owner is ${gitName}.
      //[![GitHub issues](https://img.shields.io/github/issues/${username}/${projectTitle}?style=plastic)]({$projectUrl}/issues)
      // [![GitHub forks](https://img.shields.io/github/forks/${username}/${projectTitle}?style=plastic)]({$projectUrl}/network)
      

      // `; + data
    fs.writeFile(filename, header, function (err) {
      if (err) {
        return console.log(err);
      }
      else {
        console.log(
          chalk.blueBright(
            figlet.textSync("ReadMe Complete!!", {
              font: "Doom",
              horizontalLayout: "default",
              verticalLayout: "default"
            })
          )
        );
      }
    })
}

function init() {
  getUserInput();
}
console.clear();
console.log(
  chalk.redBright(
    figlet.textSync("ReadMe Generator", {
      font: "Doom",
      horizontalLayout: "default",
      verticalLayout: "default"
    })
  )
);
init()