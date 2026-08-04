// clientMessage marks a message as one this codebase wrote and is willing to
// show. A library error can carry its own status code, and forwarding those
// verbatim would put our internals in front of a student.
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.clientMessage = message;
  return error;
}
