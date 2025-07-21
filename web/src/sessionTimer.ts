// Declare a variable to hold the interval ID for the timer.
// In browsers, setInterval returns a number (not NodeJS.Timeout).
let timerInterval: number | null = null;

// Define the default timer duration (1 hour in milliseconds).
const DEFAULT_DURATION = 60 * 60 * 1000;

/**
 * Starts the timer by recording the current timestamp in sessionStorage.
 * This marks the beginning of the timer session and persists even after page refresh.
 */
export function startTime(): void {
  const startTime = new Date().getTime(); // Get current timestamp in milliseconds
  sessionStorage.setItem('timerStartTime', JSON.stringify(startTime)); // Save as string
  console.log('Timer started at:', startTime);
}

/**
 * Retrieves the stored start time from sessionStorage.
 * If found, returns the parsed number. Otherwise, returns null.
 */
export function getStartTime(): number | null {
  const startTime = sessionStorage.getItem('timerStartTime');
  if (startTime) {
    const parsedTime = parseInt(startTime, 10);
    const elapsedTime = new Date().getTime() - parsedTime;
    console.log('Elapsed time since timer started:', elapsedTime);
    return parsedTime;
  }
  return null;
}

/**
 * Updates the timer display by calculating the remaining time based on duration.
 * @param displayElement - An HTMLElement (e.g., a <div>) where the time should be displayed.
 * @param duration - Optional timer duration (defaults to 1 hour).
 */
export function updateTimer(displayElement: HTMLElement, duration: number = DEFAULT_DURATION): void {
  const startTime = getStartTime(); // Fetch start time from session
  if (!startTime) {
    console.error('Timer has not been started.');
    return;
  }

  const currentTime = new Date().getTime(); // Current timestamp
  const elapsedTime = currentTime - startTime; // Time passed since timer started
  const remainingTime = duration - elapsedTime; // How much time is left

  if (remainingTime <= 0) {
    // If the time has expired, clear the interval and notify the user
    clearInterval(timerInterval!); // The exclamation mark tells TypeScript we know it's not null here
    timerInterval = null;
    displayElement.textContent = "Time's up!";
    console.log("Timer finished.");
  } else {
    // Convert remaining time from milliseconds to hours, minutes, seconds
    const seconds = Math.floor((remainingTime / 1000) % 60);
    const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);
    const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);

    // Update the UI with the formatted time string (e.g., 01:23:45)
    // PadStart ensures two digits for each unit
    displayElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Starts the timer interval and begins updating the display every second.
 * Also calls `startTime()` to mark the beginning.
 * @param displayElement - HTML element where the countdown will appear.
 * @param duration - Optional total time (defaults to 1 hour).
 */
export function startTimer(displayElement: HTMLElement, duration: number = DEFAULT_DURATION): void {
  if (!timerInterval) {
    startTime(); // Mark the timer start
    // Update timer display every second
    timerInterval = setInterval(() => {
      updateTimer(displayElement, duration);
    }, 1000);
    console.log("Timer interval started.");
  }
}

/**
 * Stops the timer and clears the interval.
 * Removes the stored start time and updates the UI.
 * @param displayElement - The element to show the stop message or clear the display.
 */
export function stopTimer(displayElement: HTMLElement): void {
  if (timerInterval) {
    clearInterval(timerInterval); // Stop the interval from running
    timerInterval = null; // Reset the reference
    sessionStorage.removeItem('timerStartTime'); // Clear start time from session
    displayElement.textContent = "Timer stopped."; // Update UI
    console.log("Timer stopped.");
  }
}
