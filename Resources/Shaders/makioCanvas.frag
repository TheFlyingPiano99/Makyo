#version 420 core
out vec4 FragColor;

in vec2 texCoords;
in vec4 w_rayDir;

uniform float mirrorDistance;
uniform float mirrorShininess;
uniform float mirrorDepth;
uniform float mirrorCurvatureRadius;
uniform vec3 mirrorSize;
uniform vec3 lightDir;
uniform float lightIntensity;
uniform int resolution;

/*
    Returns height and derivative of height
*/
vec2 curvature(float u, float s0, float s1, float r) {
    return vec2(
        sqrt(pow(r, 2) - pow(2 * (u - s0) / (s1 - s0) - 1, 2)) - sqrt(pow(r, 2) - 1), 

        (2 - 4 * (u - s0) / (s1 - s0)) 
        / ((s1 - s0) * sqrt(pow(r, 2) - pow(2 * (u - s0) / (s1 - s0) - 1, 2)))
    );
}

/*
    Returns height and derivative of height
*/
vec2 smoothStep(float u, float s0, float s1, float h0) {
    float c = 3; 
    return vec2(
        h0 * 0.5 * (tanh(
                                c * (
                                    2 * (u - s0) / (s1 - s0) - 1.0
                                )
                            ) / tanh(c) + 1.0
                  ),
        mirrorDepth * c / (tanh(c) * (s1 - s0)) * (
                    1.0 - pow(
                        tanh(
                            c * (
                                2 * (u - s0) / (s1 - s0) - 1
                            )
                        ), 2
                    )
                )
    );
}

vec4 normHeight(vec2 uv) {
    float s0 = 0.2;
    float s1 = 0.6;
    float h = 0;
    vec2 overallCurv = curvature(uv.x, 0, 1, mirrorCurvatureRadius);  // Overall curvature
    h += overallCurv.x;
    vec3 tanU = vec3(1, 0, overallCurv.y);
    vec3 tanV;
    if (uv.y < s0 || uv.y > s1) {
        tanV = vec3(0, 1, 0);
    }
    else if (uv.y >= s0 && uv.y <= s1) {
        vec2 stepV = smoothStep(uv.y, s0, s1, mirrorDepth);
        h += stepV.x;
        tanV = vec3(0, 2, stepV.y);
    }
    if (uv.y > s1) {
        h += mirrorDepth;
    }

    return vec4(normalize(cross(tanU * mirrorSize, tanV * mirrorSize)), h.x);
}

float mirrorBRDF(vec3 inDir, vec3 outDir, vec3 normal) {
    vec3 halfway = (inDir + outDir) / 2.0;
    return pow(max(dot(halfway, normal), 0), mirrorShininess);
}

/* Function to linearly interpolate between a0 and a1
 * Weight w should be in the range [0.0, 1.0]
 */
float interpolate(float a0, float a1, float w) {
    /* // You may want clamping by inserting:
     * if (0.0 > w) return a0;
     * if (1.0 < w) return a1;
     */
    return (a1 - a0) * w + a0;
    /* // Use this cubic interpolation [[Smoothstep]] instead, for a smooth appearance:
     * return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
     *
     * // Use [[Smootherstep]] for an even smoother result with a second derivative equal to zero on boundaries:
     * return (a1 - a0) * ((w * (w * 6.0 - 15.0) + 10.0) * w * w * w) + a0;
     */
}


/* Create pseudorandom direction vector
 */
vec2 randomGradient(int ix, int iy) {
    // No precomputed gradients mean this works for any number of grid coordinates
    uint w = 8 * 32;
    uint s = w / 2; // rotation width
    uint a = ix, b = iy;
    a *= 3284157443; b ^= a << s | a >> w-s;
    b *= 1911520717; a ^= b << s | b >> w-s;
    a *= 2048419325;
    float random = a * (3.14159265 / ~(~0u >> 1)); // in [0, 2*Pi]
    vec2 v;
    v.x = cos(random); v.y = sin(random);
    return v;
}

// Computes the dot product of the distance and gradient vectors.
float dotGridGradient(int ix, int iy, float x, float y) {
    // Get gradient from integer coordinates
    vec2 gradient = randomGradient(ix, iy);

    // Compute the distance vector
    float dx = x - float(ix);
    float dy = y - float(iy);

    // Compute the dot-product
    return (dx*gradient.x + dy*gradient.y);
}

// Compute Perlin noise at coordinates x, y
float perlin(float x, float y) {
    // Determine grid cell coordinates
    int x0 = int(floor(x));
    int x1 = x0 + 1;
    int y0 = int(floor(y));
    int y1 = y0 + 1;

    // Determine interpolation weights
    // Could also use higher order polynomial/s-curve here
    float sx = x - float(x0);
    float sy = y - float(y0);

    // Interpolate between grid point gradients
    float n0, n1, ix0, ix1, value;

    n0 = dotGridGradient(x0, y0, x, y);
    n1 = dotGridGradient(x1, y0, x, y);
    ix0 = interpolate(n0, n1, sx);

    n0 = dotGridGradient(x0, y1, x, y);
    n1 = dotGridGradient(x1, y1, x, y);
    ix1 = interpolate(n0, n1, sx);

    value = interpolate(ix0, ix1, sy);
    return value; // Will return in range -1 to 1. To make it in range 0 to 1, multiply by 0.5 and add 0.5
}


void main()
{
    vec3 wCanvasPos = vec3(2 * texCoords - 1, 0);
    vec3 wCanvasNormal = vec3(0, 0, -1);
    float I = 0.0;
    for (int x = 0; x < resolution; x++) {
        for (int y = 0; y < resolution; y++) {
            vec2 mirrorUV = vec2(x, y) / float(resolution);
            vec4 normHeight = normHeight(mirrorUV);
            vec3 mMirrorPos = vec3(2 * mirrorUV - 1, normHeight.w);
            vec3 wMirrorPos = mirrorSize * mMirrorPos - vec3(0, 0, mirrorDistance);
            vec3 wMirrorNormal = normHeight.xyz;
            vec3 toMirror = normalize(wMirrorPos - wCanvasPos);
            vec3 ld = normalize(lightDir);
            I += dot(toMirror, wCanvasNormal) * mirrorBRDF(ld, -toMirror, wMirrorNormal) * lightIntensity * dot(ld, wMirrorNormal) * pow(1.0 / float(resolution), 2);
        }
    }
    FragColor = vec4(I.x, 0, 0, 1);
}