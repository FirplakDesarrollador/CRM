@echo off

IF EXIST "c:\Users\isaza\.antigravity\extensions\dylanwatkins.n8n-as-code-cursor-0.11.1-universal\out\skills\cli.js" (
  SET N8N_AS_CODE_ASSETS_DIR=c:\Users\isaza\.antigravity\extensions\dylanwatkins.n8n-as-code-cursor-0.11.1-universal\assets
  node "c:\Users\isaza\.antigravity\extensions\dylanwatkins.n8n-as-code-cursor-0.11.1-universal\out\skills\cli.js" %*
  EXIT /B %ERRORLEVEL%
)

IF EXIST ".\node_modules\@n8n-as-code\skills\dist\cli.js" (
  node ".\node_modules\@n8n-as-code\skills\dist\cli.js" %*
  EXIT /B %ERRORLEVEL%
)

echo Error: @n8n-as-code/skills not found in node_modules
echo Please ensure it is installed as a dev dependency.
EXIT /B 1
