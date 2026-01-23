function printRunInfo({ repo, recipeId, recipeDir, projectName, composeFiles, uiUrl }) {
  console.log(`Repo: ${repo.owner}/${repo.repo}`);
  console.log(`Recipe: ${recipeId}`);
  console.log(`Recipe dir: ${recipeDir}`);
  console.log("");
  console.log("Run locally:");
  console.log(`  cd "${recipeDir}"`);
  const filesForPrint = composeFiles.map((f) => `-f "${f}"`).join(" ");
  console.log(`  docker compose -p "${projectName}" ${filesForPrint} up -d`);
  console.log("");
  if (uiUrl) console.log(`UI: ${uiUrl}`);
  console.log("");
  return { filesForPrint };
}

module.exports = {
  printRunInfo,
};
