#! /usr/bin/env node

// bootstrap-tool.mjs

import { $, argv, cd, chalk, fs, question } from "zx";

import path from "path";

import which from "which";

function exitWithError(errorMessage) {
  console.error(chalk.red(errorMessage));
  process.exit(1);
}

/**
 * Check for programs required by this script.
 */

async function checkRequiredProgramsExist(programs) {
  try {
    for (let program of programs) {
      await which(program);
    }
  } catch (error) {
    exitWithError(`Error: Required command ${error.message}`);
  }
}

await checkRequiredProgramsExist(["git", "node", "npx"]);

/**
 * Check for and change to target directory.
 */

let targetDirectory = argv.directory;
if (!targetDirectory) {
  exitWithError("Error: You must specify the --directory argument");
}

targetDirectory = path.resolve(targetDirectory);

if (!(await fs.pathExists(targetDirectory))) {
  exitWithError(`Error: Target directory '${targetDirectory}' does not exist`);
}

cd(targetDirectory);

/**
 * Check global git settings.
 */

async function getGlobalGitSettingValue(settingName) {
  $.verbose = false;

  let settingValue = "";
  try {
    settingValue = (
      await $`git config --global --get ${settingName}`
    ).stdout.trim();
  } catch (error) {
    // Ignore process output
  }

  $.verbose = true;

  return settingValue;
}

async function checkGlobalGitSettings(settingsToCheck) {
  for (let settingName of settingsToCheck) {
    const settingValue = await getGlobalGitSettingValue(settingName);
    if (!settingValue) {
      console.warn(
        chalk.yellow(`Warning: Global git setting '${settingName}' is not set.`)
      );
    }
  }
}

await checkGlobalGitSettings(["user.name", "user.email"]);

/**
 * Initialise a new git repository.
 */

await $`git init`;

/**
 * Generate a package.json file.
 */

async function readPackageJson(directory) {
  const packageJsonFilepath = `${directory}/package.json`;

  return await fs.readJSON(packageJsonFilepath);
}

async function writePackageJson(directory, contents) {
  const packageJsonFilepath = `${directory}/package.json`;

  await fs.writeJSON(packageJsonFilepath, contents, { spaces: 2 });
}

async function promptForModuleSystem(moduleSystems) {
  const moduleSystem = await question(
    `Which Node.js module system do you want to use? (${moduleSystems.join(
      " or "
    )}) `,
    {
      choices: moduleSystems,
    }
  );

  return moduleSystem;
}

async function getNodeModuleSystem() {
  const moduleSystems = ["module", "commonjs"];
  const selectedModuleSystem = await promptForModuleSystem(moduleSystems);

  const isValidModuleSystem = moduleSystems.includes(selectedModuleSystem);
  if (!isValidModuleSystem) {
    console.error(
      chalk.red(
        `Error: Module system must be either '${moduleSystems.join(
          "' or '"
        )}'\n`
      )
    );

    return await getNodeModuleSystem();
  }

  return selectedModuleSystem;
}

await $`npm init --yes`;

const packageJson = await readPackageJson(targetDirectory);
const selectedModuleSystem = await getNodeModuleSystem();

packageJson.module = selectedModuleSystem;

await writePackageJson(targetDirectory, packageJson);

/**
 * Install required project dependencies.
 */

async function promptForPackages() {
  let packagesToInstall = await question(
    "Which npm packages do you want to install for this project? "
  );

  packagesToInstall = packagesToInstall
    .trim()
    .split(" ")
    .filter((pkg) => pkg);

  return packagesToInstall;
}

async function identifyInvalidNpmPackages(packages) {
  $.verbose = false;

  let invalidPackages = [];
  for (const pkg of packages) {
    try {
      await $`npm view ${pkg}`;
    } catch (error) {
      invalidPackages.push(pkg);
    }
  }

  $.verbose = true;

  return invalidPackages;
}

async function getPackagesToInstall() {
  const packagesToInstall = await promptForPackages();
  const invalidPackages = await identifyInvalidNpmPackages(packagesToInstall);

  const allPackagesExist = invalidPackages.length === 0;
  if (!allPackagesExist) {
    console.error(
      chalk.red(
        `Error: The following packages do not exist on npm: ${invalidPackages.join(
          ", "
        )}\n`
      )
    );

    return await getPackagesToInstall();
  }

  return packagesToInstall;
}

const packagesToInstall = await getPackagesToInstall();
const havePackagesToInstall = packagesToInstall.length > 0;
if (havePackagesToInstall) {
  await $`npm install ${packagesToInstall}`;
}

/**
 * Generate a .gitignore file.
 */

await $`npx gitignore node`;

/**
 * Generate EditorConfig, Prettier and ESLint configuration files.
 */

await $`npx mrm editorconfig`;
await $`npx mrm prettier`;
await $`npx mrm eslint`;

/**
 * Generate a basic README.
 */

const { name: projectName } = await readPackageJson(targetDirectory);
const readmeContents = `# ${projectName}

...
`;

await fs.writeFile(`${targetDirectory}/README.md`, readmeContents);

/**
 * Commit the project skeleton to git.
 */

await $`git add .`;
await $`git commit -m "Add project skeleton"`;

/**
 * Confirm bootstrapping of the new project has completed successfully.
 */

console.log(
  chalk.green(
    `\n✔️ The project ${projectName} has been successfully bootstrapped!\n`
  )
);
console.log(chalk.green(`Add a git remote and push your changes.`));
