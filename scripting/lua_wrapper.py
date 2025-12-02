# scripting/lua_wrapper.py
import lupa
from lupa import LuaRuntime, LuaError
from typing import Any, Dict, List, Callable, Optional
import logging
import time
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='[LuaWrapper:%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# --- Custom Exceptions ---
class LuaExecutionError(Exception):
    """Raised when a Lua script encounters a runtime error."""
    pass

class SandboxViolationError(Exception):
    """Raised when a Lua script attempts to access a forbidden function or module."""
    pass

class ScriptTimeoutError(Exception):
    """Raised when a Lua script exceeds its execution time limit."""
    pass


class LuaSandboxWrapper:
    """
    A secure wrapper for executing Lua scripts in a sandboxed environment.
    This class provides a safe and powerful interface for embedding Lua scripting
    for dynamic agent logic, custom rules, or other extensible components
    within the Omega Platform.
    """

    def __init__(self,
                 max_memory_mb: int = 16,
                 execution_timeout_sec: float = 2.0,
                 safe_modules: Optional[List[str]] = None,
                 custom_api: Optional[Dict[str, Callable]] = None):
        """
        Initializes the Lua sandbox.

        Args:
            max_memory_mb: The maximum memory in megabytes that the Lua runtime can use.
            execution_timeout_sec: The maximum time in seconds for a script execution.
            safe_modules: A list of standard Lua modules to expose (e.g., 'math', 'string').
            custom_api: A dictionary of Python functions to expose to the Lua environment.
        """
        self.max_memory = max_memory_mb * 1024 * 1024
        self.execution_timeout = execution_timeout_sec
        self.safe_modules = safe_modules if safe_modules is not None else ['_G', 'math', 'string', 'table', 'coroutine']
        self.custom_api = custom_api if custom_api is not None else {}

        # The core of the sandbox: a restricted Lua runtime
        self._lua = LuaRuntime(
            unpack_tuples=True,
            register_eval=False, # Disable `eval` for security
            attribute_handlers=(self._getter_attribute_handler, self._setter_attribute_handler),
            # max_memory is a Lupa feature that's not always available, will handle with timeout instead
        )
        self._setup_sandbox()

    def _getter_attribute_handler(self, obj, attr_name):
        """Prevents access to potentially unsafe Python object attributes."""
        if isinstance(attr_name, str) and attr_name.startswith('_'):
            raise SandboxViolationError(f"Attempted to access private attribute '{attr_name}' from Lua.")
        return obj[attr_name]

    def _setter_attribute_handler(self, obj, attr_name, value):
        """Prevents modification of potentially unsafe Python object attributes."""
        if isinstance(attr_name, str) and attr_name.startswith('_'):
            raise SandboxViolationError(f"Attempted to modify private attribute '{attr_name}' from Lua.")
        obj[attr_name] = value

    def _setup_sandbox(self):
        """Configures the sandbox by whitelisting safe modules and functions."""
        # Create a new, clean global table for the sandbox
        self.sandboxed_globals = self._lua.eval('{}')
        
        # Whitelist safe modules from the standard library
        for module_name in self.safe_modules:
            try:
                self.sandboxed_globals[module_name] = self._lua.globals()[module_name]
            except Exception as e:
                logger.warning(f"Could not load safe module '{module_name}': {e}")
        
        # Inject the custom API functions
        for name, func in self.custom_api.items():
            self.sandboxed_globals[name] = func
        
        # The `print` function in Lua will be redirected to our logger
        self.sandboxed_globals['print'] = lambda *args: logger.info(f"Lua print: {' '.join(map(str, args))}")
        
        logger.info(f"Lua sandbox initialized. Safe modules: {self.safe_modules}. Custom API functions: {list(self.custom_api.keys())}")


    def execute_script(self, script_code: str) -> Any:
        """

        Executes a string of Lua code within the sandboxed environment.
        This is the primary method for running scripts.
        """
        try:
            # Set the sandboxed environment for the function
            lua_func = self._lua.eval(script_code, self.sandboxed_globals)
            
            # --- Timeout and Resource Limit Enforcement ---
            start_time = time.time()
            
            def timeout_interrupt_func(event, line):
                if time.time() - start_time > self.execution_timeout:
                    raise ScriptTimeoutError(f"Script exceeded execution time limit of {self.execution_timeout} seconds.")
                # Lupa doesn't have a direct memory limit, so timeout is the main safeguard
            
            self._lua.set_interrupt(timeout_interrupt_func)
            
            result = lua_func()
            
            # Disable the interrupt function after execution
            self._lua.set_interrupt(None)
            
            return result
        except LuaError as e:
            self._lua.set_interrupt(None) # Always disable interrupt on error
            logger.error(f"Lua execution error: {e}")
            raise LuaExecutionError(e) from e
        except ScriptTimeoutError as e:
            self._lua.set_interrupt(None)
            logger.error(f"Lua script timed out: {e}")
            raise e
        except Exception as e:
            self._lua.set_interrupt(None)
            logger.error(f"An unexpected error occurred during Lua execution: {e}")
            raise

    def load_and_execute_file(self, file_path: str) -> Any:
        """Loads a Lua script from a file and executes it."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Lua script file not found: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            script_code = f.read()
        
        # Prepend a 'return function()' to the script to make it executable
        wrapped_code = f"return function()
{script_code}
end"
        return self.execute_script(wrapped_code)
        

    def call_lua_function(self, func_name: str, *args) -> Any:
        """
        Calls a specific global Lua function defined in the executed script.
        
        Note: The script must have been executed first to define the function.
        """
        try:
            lua_func = self.sandboxed_globals[func_name]
            if not self._lua.is_lua_function(lua_func):
                raise AttributeError(f"'{func_name}' is not a function in the Lua environment.")
            
            start_time = time.time()
            def timeout_interrupt_func(event, line):
                if time.time() - start_time > self.execution_timeout:
                    raise ScriptTimeoutError(f"Function call '{func_name}' exceeded execution time limit of {self.execution_timeout} seconds.")
            
            self._lua.set_interrupt(timeout_interrupt_func)
            result = lua_func(*args)
            self._lua.set_interrupt(None)
            
            return result
        except LuaError as e:
            self._lua.set_interrupt(None)
            logger.error(f"Error calling Lua function '{func_name}': {e}")
            raise LuaExecutionError(e) from e
        except AttributeError as e:
            self._lua.set_interrupt(None)
            logger.error(f"Lua function call error: {e}")
            raise
        except ScriptTimeoutError as e:
            self._lua.set_interrupt(None)
            logger.error(f"Lua function call timed out: {e}")
            raise e
        except Exception as e:
            self._lua.set_interrupt(None)
            logger.error(f"An unexpected error occurred during Lua function call: {e}")
            raise


# --- Example Usage ---
if __name__ == "__main__":
    # --- 1. Define a safe API for the Lua script ---
    # These Python functions will be callable from Lua.
    def safe_get_telemetry(metric_name: str) -> Optional[float]:
        """A safe Python function to expose to Lua."""
        logger.info(f"Python safe API: get_telemetry called for '{metric_name}'")
        mock_telemetry = {
            "cpu_usage": 75.5,
            "memory_usage": 512.3,
            "network_throughput": 12.8,
        }
        return mock_telemetry.get(metric_name)

    def safe_trigger_alert(severity: int, summary: str):
        """Another safe API function."""
        logger.info(f"Python safe API: trigger_alert called with severity {severity} and summary '{summary}'")
        if severity > 10:
            raise ValueError("Severity cannot be greater than 10")


    # --- 2. Initialize the sandbox with the custom API ---
    custom_api_to_inject = {
        "get_telemetry": safe_get_telemetry,
        "trigger_alert": safe_trigger_alert,
    }
    
    lua_sandbox = LuaSandboxWrapper(custom_api=custom_api_to_inject)


    # --- 3. Define a Lua script to execute ---
    lua_script = """
    print("Lua script starting...")
    
    -- This global function will be callable from Python
    function analyze_telemetry(cpu_metric, network_metric)
        print("Lua function 'analyze_telemetry' called from Python.")
        
        -- Call back into Python to get telemetry data
        local cpu_usage = get_telemetry(cpu_metric)
        local network_throughput = get_telemetry(network_metric)
        
        if cpu_usage == nil or network_throughput == nil then
            trigger_alert(7, "Failed to retrieve telemetry data for analysis.")
            return { result="Error", reason="Telemetry not found" }
        end
        
        print("CPU Usage: "..tostring(cpu_usage))
        print("Network Throughput: "..tostring(network_throughput))
        
        -- Some complex logic
        local combined_score = cpu_usage + (network_throughput * 5)
        
        if combined_score > 150 then
            trigger_alert(9, "High combined score detected: " .. tostring(combined_score))
        else
            trigger_alert(4, "System is within normal parameters.")
        end
        
        return { result="Success", score=combined_score }
    end
    
    print("Lua script loaded. The 'analyze_telemetry' function is now defined.")
    
    -- Demonstrate a direct call to the injected API
    trigger_alert(2, "Initial script load complete.")
    
    -- Try to do something malicious (this will fail due to sandboxing)
    local status, err = pcall(function()
        local os = require('os')
        os.execute('ls /')
    end)
    if not status then
        print("Malicious action failed as expected: " .. tostring(err))
    end
    """
    
    # --- 4. Execute the script to define the functions within the sandbox ---
    try:
        logger.info("Executing Lua script to set up environment...")
        lua_sandbox.execute_script("return function()
" + lua_script + "\nend")
        logger.info("Lua script executed successfully.")
    except (LuaExecutionError, SandboxViolationError, ScriptTimeoutError) as e:
        logger.error(f"Failed to execute initial script: {e}")

    # --- 5. Call the Lua function from Python ---
    try:
        logger.info("\nCalling Lua function 'analyze_telemetry' from Python...")
        result = lua_sandbox.call_lua_function("analyze_telemetry", "cpu_usage", "network_throughput")
        logger.info(f"Python received result from Lua: {result}")
        assert result['result'] == 'Success'
        assert result['score'] == 75.5 + (12.8 * 5)
        logger.info("Lua function call successful and result validated.")
    except (LuaExecutionError, AttributeError, ScriptTimeoutError) as e:
        logger.error(f"Failed to call Lua function: {e}")

    # --- 6. Demonstrate calling a non-existent function ---
    try:
        logger.info("\nAttempting to call a non-existent Lua function...")
        lua_sandbox.call_lua_function("non_existent_function")
    except AttributeError as e:
        logger.info(f"Correctly failed to call non-existent function: {e}")