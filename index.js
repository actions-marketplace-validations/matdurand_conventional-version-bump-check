
const util = require('util');
const core = require('@actions/core');
const semver = require('semver');
const gitRawCommits = require('git-raw-commits');
const conventionalCommitsParser = require('conventional-commits-parser');
const _ = require('lodash');
const path = require('path');
const exec = require('child_process').exec;

function getLatestTag() {

  function getTags(repo, cb) {
    exec('git tag', { cwd: repo }, function(err, stdout, stderr) {
      if (err) return cb(err);
      return cb(null, stdout.toString());
    });
  }
  
  function parseTags(data) {
    return _.compact(data.split('\n'))
      .filter(semver.valid)
      .sort(semver.compare)
      .reverse();
  }
  
  function filterTags(repo, cb) {
    getTags(repo, function(err, tags) {
      if (err) { return cb(err) }
  
      try { tags = parseTags(tags); }
      catch(e) { return cb(e) }
  
      cb(null, tags);
    });
  }

  function normalizeFn(fn) {
    return function(repo, cb) {
      if (cb == null) {
        cb = repo;
        repo = process.cwd();
      }
  
      if (!repo) {
        repo = process.cwd();
      }
  
      if (repo.charAt(0) === '.') {
        repo = path.resolve(repo);
      }
  
      filterTags(repo, function(err, tags) {
        if (err) return cb('Error getting Git tags:\n' + err);
        return cb(null, fn(tags));
      });
    };
  }

  return util.promisify(normalizeFn(_.first))();
}

function getCommitsSince(tag) {
  let rawCommits = [];
  return new Promise((resolve, reject) => {
    gitRawCommits({ from: tag })
      .pipe(conventionalCommitsParser({}))
      .on('data', (res) => {
        rawCommits.push(res);
      })
      .on('error', reject)
      .on('end', () => {
        resolve(rawCommits);
      });
  });
}

const calculateBump = (commits) => {
  let increment = 'patch'

  commits.forEach(commit => {
    if (commit.notes.length > 0) {
      increment = 'major'
    } else if (commit.type === 'feat') {
      if (increment === 'patch') {
        increment = 'minor'
      }
    }
  })

  return increment;
}

async function recommendedBump(commits) {
  if (commits && commits.length > 0) {
    return calculateBump(commits);
  }
  return false;
}

async function checkVersionBump(currentVersion, verbose) {
  const latestTag = await getLatestTag();
  if (!latestTag) {
    throw new Error("Could not find the latest git tag");
  }
  if (verbose) { core.info(`Found latest tag: ${latestTag}`); }

  const rawCommits = await getCommitsSince(latestTag);
  if (verbose) { 
    core.info(`Found the following commits from the latest tag ${latestTag}`);
    rawCommits.forEach(c => core.info(JSON.stringify(c)));
  }

  const increment = await recommendedBump(rawCommits);
  if (increment) {
    if (verbose) { core.info(`Version increment should be applied to [${increment}]`); }

    const expectedVersion = semver.inc(latestTag, increment, false);

    if (expectedVersion !== currentVersion) {
      throw new Error(`Current version is ${currentVersion}, but should be ${expectedVersion} according to your commits from the last tag ${latestTag}`);
    } else {
      if (verbose) { core.info(`Current version ${currentVersion} matches the increment required by your commits from the latest tag ${latestTag}`); }
    }
  } else {
    core.info('No version bump necessary');
  }
  
}

async function main() {
  try {
    const currentVersion = core.getInput('current-version', {required: true});
    const verbose = core.getInput('verbose', {required: false}) === 'true';
    await checkVersionBump(currentVersion, verbose);
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();