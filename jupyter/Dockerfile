FROM quay.io/jupyter/minimal-notebook:latest

# See full list of configuration parameters: https://jupyter-notebook.readthedocs.io/en/v6.5.2/config.html
# 
# NotebookApp.allow_origin=* -> needed to enable using nginx as a proxy. (see Blocking Cross Origin API request)
# ip=* -> needed to accept requests that are originated from another machine
# NotebookApp.token='' -> needed to turn off token authentication. See https://jupyter-notebook.readthedocs.io/en/v6.5.2/security.html#alternatives-to-token-authentication
# NotebookApp.password='' -> needed to turn off password protected. See https://jupyter-notebook.readthedocs.io/en/v6.5.2/security.html#alternatives-to-token-authentication
CMD ["jupyter", "notebook", "--ip", "*", "--NotebookApp.allow_origin", "*", "--NotebookApp.token", "''", "--NotebookApp.password", "''", "--notebook-dir", "/mnt/work"]