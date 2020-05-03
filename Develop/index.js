/*
-Get user input
-Make API request to GitHub API
-Email and profile image
-Populate Readme.medium

*/
const api = require("./utils/api.js");

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
let credit ="";
let result

const questions = [
  {
    type: "input",
    message: "Please enter your GitHub username: ",
    name: "username",
    validate: async function(input){
      
      const gitInfo = await api(input)
      if(gitInfo === null){
        return 'You need to provide a valid GitHub UserName.' ;
      }else {
        result = gitInfo
        return true
      }
    
    }
  },
  {
    type: "input",
    message: "What is your Project's title?",
    name: "projectTitle",
  },
  {
    type: "input",
    message: "Description of yourProject's purpose?\n Default will be 'To be written...'",
    name: "description",
    default: "To be Written...",
  },
  {
    type: "confirm",
    message: "Do you need a Table of Contents?",
    name: "tableOfContents"
  },
  {
    type: "input",
    message: "How do we Install your project?\n Default will be 'npm install'",
    name: "install",
    default: "npm install"
  },
  {
    type: "input",
    message: "How will we use/run this Project?\n Default will be 'node index.js'.",
    name: "usage",
    default: "node index.js"

  },
  {
    type: "list",
    name: "license",
    message: "GitHub suggest you always add a license to your project. \nWhat License do you want to apply to this Project?\n Default is MIT.",
    choices: ['MIT','Apache 2.0', 'GNU AGPLv3', 'GNU GPLv3', 'GPLv3', 'Mozilla Public License 2.0', 'The Unlicense'],
    default: 'MIT',
  },
  {
    type: "input",
    message: "Would you like to add Contrubutors or Tutorials?\nThese names will show up under the 'Credit' heading.\n(Enter their GitHub usernames separated by commas',')",
    name: "contributors"
  },
  {
    type: "input",
    message: "Would you like to add additional Modules requirements?\n(Enter their npmjs names separated by commas)",
    name: "modules"
  },
  {
    type: "input",
    message: "How do you run Tests?\n Default is 'npm test'.",
    name: "tests",
    default: "npm test"
  },
  {
    type: "confirm",
    message: "Would you like to include the Contrubutor Covenant in your ReadMe?",
    name: "conCov"
  }

];

const retryUserName = [
  {
    type: "input",
    message: "Please enter your GitHub username: ",
    name: "username"
  }];

const getUserInput = async () => {
  try {
    const input = await inquirer.prompt(questions);
    if (input === null) {
      console.log("GitHub username does not exist.", input);
      const usernameRetry = async () => {
        try{
          const input = await inquirer.prompt(retryUserName);
        }
        catch (error) {
          console.log (error);
        }
      }
    }
    writeToFile(input, "readME.md")
  } 
  catch (error){
    console.log("In getUserInput catch error: ",error);
  }
};

  
async function writeToFile (data, filename) {
  
  const {username, projectUrl, conCov} = data
  //const gitInfo = await getUsername(username); <--was working 
  // const gitInfo = async () => {

  // };
  console.log("Line 136 result: ",result);
  // const result = await api(username);
  const avatar_url = !result ? "https://randomwordgenerator.com/picture.php" : result.avatar_url
  const gituserUrl = result.html_url;
  const gitName = !result.name ? username : result.name;
  const gitEmail = result.email;

    //console.log("Sorry no data retrieved!", error);
    let tableOfContents = data.tableOfContents;
    let projectTitle = data.projectTitle; //Todo parse string to remove spaces and replace with %20
    let projectDescription = data.description;
    let install = data.install;
    let usage = data.usage;
    let collaborators = data.contributors;
    if (!data.contributors){
    let collaborators = "";
    }
    else{
      creditTOC = "* [Credit](#credit)  \n";
      const collabArr = collaborators.split(", ");
      collabArr.forEach(function (collaborators){
        let name = collaborators;
        console.log("Credit: ",name);
        //names = await api(username);
        //credit = "![" + names.name +"](" + names.avatar_url + "&s=48) " + names.credit + "\n";
        credit = `${credit}*  ${collaborators}  \n`;
      })
      // credit.forEach(await function api(names){
      //   credit = "![" + names.name +"](" + names.avatar_url + "&s=48) " + names.credit + "\n";
      //   console.log("Line 146 credit: ",credit);
      // });
    }
    let mods = "";
    let modulesTOC = "* [Dependencies](#dependencies)  \n";
    let modules = data.modules;
    if(!modules){
      modulesTOC = "";
      mods = "";
    }
    else {
      modArr = modules.split(", ");
      modArr.forEach(function (modules, index){
        mods = mods +  "* " + modArr[index] + "\n";
      }
      
      ) 
    }
    let license = data.license;
    let urprojectUrl = data.projectUrl;
    let questionsTOC = "* [Questions](#questions) \n";
    let questions = "## Questions \n";
    let questionsLink = "![" + gitName +"](" + avatar_url + "&s=48)  Email: [" + gitName + "](mailto:" + gitEmail + ") or  click on [@" + gitName + "]("+ gituserUrl+ ")";
    //Community Contribution Guidelines
    let conCovenantBadge = `[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg?style=plastic)](code_of_conduct.md) `;
    let conCovenant = "## Contrubuting Guidelines \n This Repo proudly follows the [Contributor Covenant](https://www.contributor-covenant.org/) which is an industry standard. \n";
    let conCovTOC = "* [Contributing](#contributing)  \n";
    if(!conCov){
      conCovenantBadge = "";
      conCovenant = "";
      conCovTOC = "";
    }
   
    //build Table of Contents
    if(!tableOfContents){
      tableOfContents = "";
    }
    else{
      tableOfContents = "* [Installation](#installation)  \n";
      tableOfContents = tableOfContents + "* [Usage](#usage)  \n";
      tableOfContents = tableOfContents + creditTOC;  
      tableOfContents = tableOfContents + "* [License](#license)  \n";
      tableOfContents = tableOfContents + conCovTOC;
      tableOfContents = tableOfContents +  modulesTOC;
      tableOfContents = tableOfContents + questionsTOC; 

    }
    license = "[" +  license + "]" + "(https://github.com/"  + username + "/"+ projectTitle + "/blob/master/LICENSE)"; 
    switch (license) {
      case 'Apache 2.0' :
        license = license + " -A permissive license whose main conditions require preservation of copyright and license notices. Contributors provide an express grant of patent rights. Licensed works, modifications, and larger works may be distributed under different terms and without source code.\n";
        break;
      case 'GNU AGPLv3' :
        license = license + " -Permissions of this strongest copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights. When a modified version is used to provide a service over a network, the complete source code of the modified version must be made available.\n"; 
        break;
      case 'GNU GPLv3' : 
        license = license + " -Permissions of this strong copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.\n";
        break;
      case 'GPLv3' : 
        license = license + " -Permissions of this strong copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.\n";
        break;
      case 'MIT' : 
        license = license + " -A short and simple permissive license with conditions only requiring preservation of copyright and license notices. Licensed works, modifications, and larger works may be distributed under different terms and without source code.\n";
        break;
      case 'Mozilla Public License 2.0' : 
        license = license + " -Permissions of this weak copyleft license are conditioned on making available source code of licensed files and modifications of those files under the same license (or in certain cases, one of the GNU licenses). Copyright and license notices must be preserved. Contributors provide an express grant of patent rights. However, a larger work using the licensed work may be distributed under different terms and without source code for files added in the larger work.\n";
        break;
      default :  //'The Unlicense' 
        license = license + " -A license with no conditions whatsoever which dedicates works to the public domain. Unlicensed works, modifications, and larger works may be distributed under different terms and without source code.\n";
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
    header = header + "\`\`\` \n" + install + " \n" + "\`\`\` \n";
    header = header + "## Usage  \n";
    header = header + "\`\`\` \n" + usage + " \n" + "\`\`\` \n";
    header = header + "## Credit  \n";
    header = header + credit + "  \n";
    //header = header +  collaborators + " \n ";
    header = header + "## License  \n";
    header = header + license + "  \n";
    header = header + conCovenant + " \n";
    header = header + "## Dependencies  \n" + mods;
    header = header + questions + questionsLink;

    
    
    
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
     
    fs.writeFile(filename, header, function (err) {
      if (err) {
        return console.log(err);
      }
      else {
        const success = (filepath) => {
          console.log(
            chalk.white.bgGreen.bold(`Done! File created at ${filepath}`)
          );
        };
        console.log(
          chalk.magentaBright(
            figlet.textSync( projectTitle, {
              font: "Doom",
              horizontalLayout: "default",
              verticalLayout: "default"
            })
          )
        );
        console.log(
          chalk.blueBright(
            figlet.textSync( "ReadMe Complete!!", {
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
  chalk.bgRed(
    figlet.textSync("ReadMe Generator", {
      font: "Doom",
      horizontalLayout: "default",
      verticalLayout: "default"
    })
  )
);
init()