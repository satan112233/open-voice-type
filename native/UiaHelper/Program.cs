using System.Text.Json;
using System.Windows.Automation;

namespace UiaHelper;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.WriteLine("Usage: UiaHelper.exe --read-focus | --watch-focus");
            return;
        }

        try
        {
            switch (args[0])
            {
                case "--read-focus":
                    ReadFocusedElement();
                    break;
                case "--watch-focus":
                    WatchFocus();
                    break;
                default:
                    Console.Error.WriteLine($"Unknown argument: {args[0]}");
                    Environment.Exit(1);
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            Environment.Exit(1);
        }
    }

    static void ReadFocusedElement()
    {
        var element = AutomationElement.FocusedElement;
        var result = ExtractValue(element);
        Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
    }

    static void WatchFocus()
    {
        AutomationElement? lastElement = null;

        Automation.AddAutomationFocusChangedEventHandler((sender, e) =>
        {
            try
            {
                if (sender is not AutomationElement element) return;
                if (lastElement != null && element.Equals(lastElement)) return;

                lastElement = element;
                var result = ExtractValue(element);
                var json = JsonSerializer.Serialize(result, JsonOptions);
                Console.WriteLine(json);
            }
            catch
            {
                // Ignore transient errors during focus changes
            }
        });

        // Keep the process alive until stdin is closed (parent kills us)
        Console.ReadLine();
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    static FocusInfo ExtractValue(AutomationElement element)
    {
        var controlType = element.Current.ControlType.ProgrammaticName;
        var automationId = element.Current.AutomationId ?? "";
        var className = element.Current.ClassName ?? "";
        var name = element.Current.Name ?? "";
        var runtimeId = string.Join(".", element.GetRuntimeId() ?? Array.Empty<int>());

        // Try ValuePattern first (TextBox, ComboBox, etc.)
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valueObj) && valueObj is ValuePattern valuePattern)
        {
            return new FocusInfo
            {
                ControlType = controlType,
                AutomationId = automationId,
                ClassName = className,
                Name = name,
                RuntimeId = runtimeId,
                HasValue = true,
                Value = valuePattern.Current.Value ?? ""
            };
        }

        // Fall back to TextPattern (document-like controls)
        if (element.TryGetCurrentPattern(TextPattern.Pattern, out var textObj) && textObj is TextPattern textPattern)
        {
            var range = textPattern.DocumentRange;
            return new FocusInfo
            {
                ControlType = controlType,
                AutomationId = automationId,
                ClassName = className,
                Name = name,
                RuntimeId = runtimeId,
                HasValue = true,
                Value = range.GetText(-1) ?? ""
            };
        }

        return new FocusInfo
        {
            ControlType = controlType,
            AutomationId = automationId,
            ClassName = className,
            Name = name,
            RuntimeId = runtimeId,
            HasValue = false,
            Value = ""
        };
    }
}

public class FocusInfo
{
    public string ControlType { get; set; } = "";
    public string AutomationId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string Name { get; set; } = "";
    public string RuntimeId { get; set; } = "";
    public bool HasValue { get; set; }
    public string Value { get; set; } = "";
}
