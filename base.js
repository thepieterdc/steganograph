// The Hamming (7, 4) parity-check matrix.
const hamming74ParityMatrix = [
  [1, 0, 1, 0, 1, 0, 1],
  [0, 1, 1, 0, 0, 1, 1],
  [0, 0, 0, 1, 1, 1, 1],
];

/**
 * Converts the given input number to a binary array.
 *
 * @param {Number} number
 * @returns array of bits (MSB)
 */
function binarify(i) {
  return math.matrix([
    (i & 1) == 0 ? 0 : 1, // b1
    (i & (1 << 1)) == 0 ? 0 : 1, // b2
    (i & (1 << 2)) == 0 ? 0 : 1, // b3
    (i & (1 << 3)) == 0 ? 0 : 1, // b4
    (i & (1 << 4)) == 0 ? 0 : 1, // b5
    (i & (1 << 5)) == 0 ? 0 : 1, // b6
    (i & (1 << 6)) == 0 ? 0 : 1, // b7
  ]);
}

/**
 * Creates the bit groups of length 16, each containing 8 bitvectors of length 7.
 *
 * @returns array G of array of bitvectors G^u
 */
function createBitGroups() {
  // Create the empty arrays.
  const groups = [];
  for (let i = 0; i < 16; i++) {
    groups.push(new Array(8));
  }

  const H = math.matrix(hamming74ParityMatrix);

  // Populate the arrays.
  for (let i = 0; i < 128; i++) {
    // Represent i as a bitvector.
    const gvec = binarify(i);

    // Calculate the u value.
    const gvecArray = gvec.valueOf();
    u =
      (gvecArray[2] << 3) |
      (gvecArray[4] << 2) |
      (gvecArray[5] << 1) |
      gvecArray[6];

    // Calculate the v value using the Hamming parity-check matrix.
    const Hgvec = math.transpose(math.multiply(H, math.transpose(gvec)));
    const v = Hgvec.valueOf().map((i) => i % 2);
    const vDec = (v[0] << 2) | (v[1] << 1) | v[2];
    groups[u][vDec] = gvecArray;
  }

  return groups;
}

/**
 * Decodes the given image to find the message.
 *
 * @param {HTMLImageElement} image the original image element
 * @param {string} messageLength the length of the message to decode
 * @param {HTMLElement} resultsContainer the element to write the result to
 */
function decode(image, messageLength, resultsContainer) {
  // Validate input arguments.
  if (!image.src || messageLength.length === 0) {
    return;
  }

  // Get the input data.
  const W = image.naturalWidth;
  const H = image.naturalHeight;
  messageLength = parseInt(messageLength);

  // Get the image data.
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, W, H).data;

  // Create the Hamming (7, 4) parity matrix.
  const H74 = math.matrix(hamming74ParityMatrix);

  // Iterate over the letters to decode.
  let result = "";
  for (let i = 0; i < messageLength; ++i) {
    // Read the next 7 pixel LSB's into a bitvector.
    const p1 = imageData[7 * i] & 1;
    const p2 = imageData[7 * i + 1] & 1;
    const p3 = imageData[7 * i + 2] & 1;
    const p4 = imageData[7 * i + 3] & 1;
    const p5 = imageData[7 * i + 4] & 1;
    const p6 = imageData[7 * i + 5] & 1;
    const p7 = imageData[7 * i + 6] & 1;
    const lsbs = [p1, p2, p3, p4, p5, p6, p7];

    // Calculate the syndrome vector.
    const syndrome = math.multiply(H74, lsbs).valueOf().map((i) => i % 2);
    
    // Reconstruct the encoded letter.
    const lvec = [syndrome[0], syndrome[1], p3, syndrome[2], p5, p6, p7];
    const l = (lvec[6] << 6) | (lvec[5] << 5) | (lvec[4] << 4) | (lvec[3] << 3) | (lvec[2] << 2) | (lvec[1] << 1) | (lvec[0]);
    result += String.fromCharCode(l);
  }

  // Set the result message.
  resultsContainer.innerText = result;
}

/**
 * Encodes the given message in the image.
 *
 * @param {HTMLImageElement} image the original image element
 * @param {string} message the message to encode
 * @param {HTMLImageElement} encodedImage the resulting image element
 */
function encode(image, message, encodedImage) {
  // Validate input arguments.
  if (!image.src || message.length === 0) {
    return;
  }

  if (message.length > maximumMessageLength(image)) {
    return;
  }

  // Get the image data.
  const W = image.naturalWidth;
  const H = image.naturalHeight;

  // Create a canvas to draw on.
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const ctxImage = ctx.getImageData(0, 0, W, H);
  const imageData = ctxImage.data;

  // Create the bit groups.
  const groups = createBitGroups();

  // Convert the text to a binary format.
  const messageData = textToBytes(message);
  if (messageData.some((v) => v > 127)) {
    alert("ASCII values above 127 are not currently supported.");
    throw Error("ASCII values above 127 are not currently supported.");
  }

  // Iterate over the bytes in the text.
  messageData.forEach((l, i) => {
    // Parse l to a bitvector.
    const lvec = binarify(l).valueOf();

    // Calculate u and v and find the replacement vector.
    const u = (lvec[2] << 3) | (lvec[4] << 2) | (lvec[5] << 1) | lvec[6];
    const v = (lvec[0] << 2) | (lvec[1] << 1) | lvec[3];
    const replacement = groups[u][v];

    // Replace the LSBs of the 7 next pixels with the replacement vector.
    for (let pi = i * 7; pi < (i + 1) * 7; pi++) {
      imageData[pi] = ((imageData[pi] >> 1) << 1) | replacement[pi % 7];
    }
  });

  // Display the new image.
  ctx.putImageData(ctxImage, 0, 0, 0, 0, W, H);
  encodedImage.src = canvas.toDataURL();
}

/**
 * Calculates the maximum length of the message to be encoded.
 * 
 * @param {HTMLImageElement} image input image
 * @returns maximum length of the encoded message
 */
function maximumMessageLength(image) {
  return ((image.naturalWidth * image.naturalHeight) || 1) - 1;
}

/**
 * Converts the given string to bytes.
 *
 * @param {string} message the input message
 * @returns byte representation of the message
 */
function textToBytes(message) {
  const encoder = new TextEncoder();
  return encoder.encode(message);
}
