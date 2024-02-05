# ======================================================= #
#  IBM Cloud Code Engine - Functions-as-a-Service Sample  #
#                                                         #
#  __main.py__ (Python sample function)                   #
#                                                         #
#  Returns a simple HTML response, containing a message   #
#  that renders a greeting text. If the `name` parameter  #
#  was used to invoke the function, the given value       #
#  will be used in the greeting. If no `name` parameter   #
#  was used, a static text will be rendered instead.      #
#                                                         #
#  This sample shows how to access URL parameters in a    #
#  function.                                              #
#                                                         #
#  To pass a name to the function, which will be used     #
#  to render a personalized greeting, invoke the function #
#  with a parameter called 'name':                        #
#                                                         #
#  <function url>?name=<your name>                        #
#                                                         #
# ======================================================= #

##
 # The `main` function is the entry-point into the function.
 # 
 # A function can define multiple functions, but it needs to
 # have one dedicated 'main' function, which will be called
 # by the runtime.
 # 
 # The 'main' function has one optional argument, which 
 # carries all the parameters the function was invoked with.
 # 
 # Those arguments are dynamic and can change between 
 # function invocations. 
 # 
 # Additionally, a function has access to some 
 # predefined and also user-defined environment variables.
 #  
 
def main(params):
    if "name" in params:
        # if an argument with name 'name' was given during 
        # function invocation, build a greeting for the given
        # name
        msg = f"Hello, {params['name']}!"
    else:
        # if no argument with name 'name' was found, use
        # a static greeting string instead
        msg = f"Hello, Functions on Code Engine!"

    # finally, build an HTML response that can be rendered 
    # properly in a browser. To do so, we need to specify
    # the correct 'Content-Type' ('text/html' for HTML markup)
    # Alternatively, we could also use 'text/plain' or 
    # 'application/json', depending on the text we plan to 
    # return.
    return {
        # specify headers for the HTTP response
        # we only set the Content-Type in this case, to 
        # ensure the text is properly displayed in the browser
        "headers": {
            'Content-Type': 'text/html; charset=utf-8',
        },
        
        # explicitly set the HTTP status code to 200
        "statusCode": 200,
        
        # the body of the HTTP response carries the data, our
        # function wants to return
        # construct a very simple HTML page, which renders
        # the greeting string, we constructed earlier as a 
        # level 3 header
        "body": f"<html><body><h3>{msg}</h3></body></html>",
    }

# Optional:
#   If you used a function name different from 'main', make
#   the function known under the 'main' symbol to the 
#   runtime, so it can be invoked.
#
#   Example:
#
#   def my_main_func_with_another_name(params) {
#     ...
#   }
#   ...
#   main = my_main_func_with_another_name