from setuptools import setup, find_packages

setup(
    name='cos2cos',
    version='0.1',
    packages=find_packages(),
    install_requires=[
        'click',
        'flask',
        'requests',
        'ibm-cos-sdk'
    ],
    entry_points='''
        [console_scripts]
        c2c=cos_2_cos:start_server
    ''',
)
