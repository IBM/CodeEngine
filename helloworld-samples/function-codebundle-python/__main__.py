import pyjokes

def main(params):
     return {
          "headers": {
              "Content-Type": "text/plain;charset=utf-8",
          },
          "body": pyjokes.get_joke(),
      }
