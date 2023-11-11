from lorem_text import lorem


def main(params):
     words = 10

     return {
          "headers": {
              "Content-Type": "text/plain;charset=utf-8",
          },
          "body": lorem.words(words),
      }
