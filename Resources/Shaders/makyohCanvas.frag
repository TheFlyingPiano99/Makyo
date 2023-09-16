#version 420 core
out vec4 IrradianceHeightOut; // ([W/m^2], [m])
out vec3 NormalOut;

in vec2 texCoords;
in vec4 w_rayDir;

uniform int mirrorSampleCountPerPixel;
uniform vec2 mirrorSampleAreaScale;
uniform float wMirrorDistance;
uniform float mirrorShininess;
uniform float wMirrorDepth;
uniform float wMirrorBackgroundConvexity;
uniform float wMirrorBackgroundRadius; 
uniform float wMirrorCurvatureRadius;
uniform vec2 wMirrorSize; // Should be (1, 1)
uniform vec2 wCanvasSize; // Should be (1, 1)
uniform vec4 wLightPos;
uniform float lightPowerDensity;
uniform float mirrorConvexity;
uniform float wShapeOutlineWidth;
uniform float wCarvRadius;
uniform float carvConvexity;
uniform int lineMode;   // 0 ... step, 1 ... carving, 2 ... flat obj
uniform float _sx0;
uniform float _sx1;
uniform float _sx2;
uniform float _sx3;
uniform float _sy0;
uniform float _sy1;
uniform float _sy2;
uniform float _sy3;

float m_pi = 3.141592653589793;

/*
    Returns height and derivative of height
*/
vec2 curvature(vec2 uv, int direction, float s0, float s1, float r, float convexity) {
    float widthSquared = pow(wMirrorSize[direction], 2);
    return convexity * vec2(
        sqrt(pow(r, 2) - widthSquared * pow(uv[direction] - (s0 + s1) / 2.0, 2)) - sqrt(pow(r, 2) - widthSquared * pow((s1 - s0) / 2.0, 2)),

        widthSquared * ((s0 + s1) / 2.0 - uv[direction]) 
        / sqrt(pow(r, 2) - widthSquared * pow(uv[direction] - (s0 + s1) / 2.0, 2))
    );
}

/*
 Returns height, derivative of height by u and by v
*/
vec3 sphericalCurvature(vec2 uv, float u0, float u1, float v0, float v1, float r, float convexity) {
    float widthSquared = pow(wMirrorSize.x, 2);
    float heightSquared = pow(wMirrorSize.y, 2);
    return convexity * vec3(
        sqrt(pow(r, 2) - widthSquared * pow(uv.x - (u1 + u0) / 2.0, 2) - heightSquared * pow(uv.y - (v1 + v0) / 2.0, 2) ) 
            - sqrt(pow(r, 2) - widthSquared * pow((u1 - u0) / 2.0, 2) - heightSquared * pow((v1 - v0) / 2.0, 2)),

        widthSquared * ((u0 + u1) / 2.0 - uv.x) 
        / sqrt(pow(r, 2) - widthSquared * pow(uv.x - (u1 + u0) / 2.0, 2) - heightSquared * pow(uv.y - (v1 + v0) / 2.0, 2) ),

        heightSquared * ((v0 + v1) / 2.0 - uv.y) 
        / sqrt(pow(r, 2) - widthSquared * pow(uv.x - (u1 + u0) / 2.0, 2) - heightSquared * pow(uv.y - (v1 + v0) / 2.0, 2) ) 
    );
}

/*
    Returns height and derivative of height
*/
vec2 smoothStep(float u, float s0, float s1, float h0, float dir) {
    float c = 3; 
    return vec2(
        h0 * (1 - dir) * 0.5 + dir * h0 * 0.5 * (tanh(
                                c * (
                                    2 * (u - s0) / (s1 - s0) - 1.0
                                )
                            ) / tanh(c) + 1.0
                  ),
        dir * h0 * c / (tanh(c) * (s1 - s0)) * (
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


vec2 smoothStepCurvature(vec2 uv, int direction, float s0, float s1, float h0) {
    float c = 3;
    float middle = (s0 + s1) * 0.5;
    if (uv[direction] <= middle) {
        return smoothStep(uv[direction], s0, middle, h0, 1) * vec2(1, 2);
    }
    else {
        return smoothStep(uv[direction], middle, s1, h0, -1) * vec2(1, 2);
    }
}


vec3 topSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.x <= _sx1 + uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.x, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.x >= _sx2 - uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.x, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.y <= _sy0 + uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy0, _sy0 + uvLineWidth.y, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy0, _sy0 + uvLineWidth.y, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy0, _sy0 + uvLineWidth.y, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx1 + uvLineWidth.x, _sx2 - uvLineWidth.x, _sy0 + uvLineWidth.y, _sy1,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}

vec3 bottomSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.x <= _sx1 + uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.x, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.x >= _sx2 - uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.x, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.y >= _sy3 - uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy3 - uvLineWidth.y, _sy3, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy3 - uvLineWidth.y, _sy3, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy3 - uvLineWidth.y, _sy3, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx1 + uvLineWidth.x, _sx2 - uvLineWidth.x, _sy2, _sy3 - uvLineWidth.y,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}

vec3 leftSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.y <= _sy1 + uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.y >= _sy2 - uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.x <= _sx0 + uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.x, _sx0, _sx0 + uvLineWidth.x, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 0, _sx0, _sx0 + uvLineWidth.x, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 0, _sx0, _sx0 + uvLineWidth.x, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx0 + uvLineWidth.x, _sx1, _sy1 + uvLineWidth.y, _sy2 - uvLineWidth.y,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}
vec3 rightSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.y <= _sy1 + uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.y, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.y >= _sy2 - uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.x >= _sx3 - uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.x, _sx3 - uvLineWidth.x, _sx3, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 0, _sx3 - uvLineWidth.x, _sx3, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 0, _sx3 - uvLineWidth.x, _sx3, wMirrorDepth);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx2, _sx3 - uvLineWidth.x, _sy1 + uvLineWidth.y, _sy2 - uvLineWidth.y,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}

/*
    Calculates the normal and the height of the mirror at a given UV coordinate.
*/
vec4 normHeight(vec2 uv) {

    float wHeight = 0;
    float wDU = 0;
    float wDV = 0;

    // Overall curvature
    vec3 overallCurv = sphericalCurvature(uv, 0, 1, 0, 1, wMirrorCurvatureRadius, mirrorConvexity);
    wHeight += overallCurv.x;
    wDU += overallCurv.y;
    wDV += overallCurv.z;
    
    // Cross shape
    if (uv.x >= _sx0 && uv.x <= _sx3) { // horizontally in shape
        if (uv.y >= _sy0 && uv.y <= _sy3) { // vertically in shape
            if (uv.x >= _sx1 && uv.x <= _sx2) { // middle column
                if (uv.y < _sy1) {  // Top square
                    vec3 retVal = topSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;
                }
                else if (uv.y > _sy2) { // Bottom square
                    vec3 retVal = bottomSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;   
                }
                else if (0 == lineMode) { // Middle square
                    wHeight += wMirrorDepth;
                }
                else if (2 == lineMode) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx1, _sx2, _sy1, _sy2,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
            }
            else if (uv.x < _sx1) { // left column
                if (uv.y >= _sy1 && uv.y <= _sy2) { // left square
                    vec3 retVal = leftSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;   
                }
                else if (uv.y < _sy1) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx0, _sx1, _sy0, _sy1,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
                else if (uv.y > _sy2) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx0, _sx1, _sy2, _sy3,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
            }
            else if (uv.x > _sx2) { // right column
                if (uv.y >= _sy1 && uv.y <= _sy2) { // right square
                    vec3 retVal = rightSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;
                }
               else if (uv.y < _sy1) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx2, _sx3, _sy0, _sy1,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
                else if (uv.y > _sy2) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx2, _sx3, _sy2, _sy3,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
            }
        }
    }

    // Tangent vectors:
    /*
    wMirrorSize is needed because earlier we parametrized
    the surface function with uv coordiantes of range [0,1]
    */
    vec3 tanU = vec3(wMirrorSize.x, 0, wDU);
    vec3 tanV = vec3(0, wMirrorSize.y, wDV);

    return vec4(normalize(cross(tanU, tanV)), wHeight);
}

float mirrorBRDF(vec3 inDir, vec3 outDir, vec3 normal) {
    float c_n = (mirrorShininess + 2.0) / 2.0 / m_pi;
    float dotNL = dot(normal, inDir);
    float dotNV = dot(normal, outDir);
    return c_n * pow(max(2.0 * dotNL * dotNV - dot(inDir, outDir), 0.0), mirrorShininess)
        / max(dotNL, dotNV);
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


// ------------------------- RANDOM GENERATION ----------------------------------------------

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
    vec3 wCanvasPos = vec3((texCoords - 0.5) * wCanvasSize, 0.0);    // The canvas is always in z = 0 plane.
    vec3 wCanvasNormal = vec3(0, 0, -1);                            // The canvas is always facing ing -z direction.
    dvec2 wMirrorDelta = dvec2(wMirrorSize) / double(mirrorSampleCountPerPixel) * double(mirrorSampleAreaScale);    // The size of a single small square

    double M = 0.0;  // Irradiance of canvas point [W/m^2]
    for (int x = 0; x < mirrorSampleCountPerPixel; x++) {
        for (int y = 0; y < mirrorSampleCountPerPixel; y++) {
            vec2 mirrorUV = texCoords       // Most of the functions work with the [0, 1] uv coordinates.
                + (vec2(x, y) / float(mirrorSampleCountPerPixel) - 0.5) * mirrorSampleAreaScale
                
                + mirrorSampleAreaScale / float(mirrorSampleCountPerPixel)   // Apply noise to sampling
                * (2.0 * vec2(
                    perlin(1000.0 * texCoords.x  + x, 1000.0 * texCoords.y + y),
                    perlin(1000.0 * texCoords.x + x, 1000.0 * texCoords.y - y)
                ) - 1.0)
                
                ;
            if (mirrorUV.x < 0 || mirrorUV.x > 1 || mirrorUV.y < 0 || mirrorUV.y > 1) {
                continue;   // Skip this position if it is outside of the mirror area.
            }
            vec4 wNormHeight = normHeight(mirrorUV);
            vec3 wMirrorPos = vec3((mirrorUV - 0.5) * wMirrorSize, wNormHeight.w - wMirrorDistance);
            vec3 wMirrorNormal = wNormHeight.xyz;
            vec3 wToMirror = normalize(wMirrorPos - wCanvasPos);
            vec3 wToLight = normalize(wLightPos.xyz - wMirrorPos * wLightPos.w);    // Direction if wLightPos.w = 0.
            float wLightDitanceSquare = dot(wToLight, wToLight);
            vec3 wLightDir = wToLight / sqrt(wLightDitanceSquare );
            
            dvec3 dwCanvasPos = dvec3(wCanvasPos);
            double a_x = length(dvec3(wMirrorPos.xy, -wMirrorDistance) - dvec3(wMirrorDelta.x, 0, 0) / 2.0 - dwCanvasPos);
            double b_x = length(dvec3(wMirrorPos.xy, -wMirrorDistance) + dvec3(wMirrorDelta.x, 0, 0) / 2.0 - dwCanvasPos);
            double c_x = wMirrorDelta.x;
            double delta_x = acos(float((a_x * a_x + b_x * b_x - c_x * c_x) / (2.0 * a_x * b_x)));  // Angle in x direction

            double a_y = length(dvec3(wMirrorPos.xy, -wMirrorDistance) - dvec3(0, wMirrorDelta.y, 0) / 2.0 - dwCanvasPos);
            double b_y = length(dvec3(wMirrorPos.xy, -wMirrorDistance) + dvec3(0, wMirrorDelta.y, 0) / 2.0 - dwCanvasPos);
            double c_y = wMirrorDelta.y;
            double delta_y = acos(float((a_y * a_y + b_y * b_y - c_y * c_y) / (2.0 * a_y * b_y)));  // Angle in y direction
            double omega = float(delta_x * delta_y);    // Solid angle

            double Lin =     // Radiance of mirror surface area
                double(lightPowerDensity / wLightDitanceSquare)
                * double(max(dot(wLightDir, wMirrorNormal), 0))
                * double(mirrorBRDF(wLightDir, -wToMirror, wMirrorNormal));   // approximation of integral over Omega (M_l * cos(theta) * BRDF)
            M += double(max(dot(wToMirror, wCanvasNormal), 0)) * Lin * omega;    // approximation of integral over Omega [L_in * cos(theta)] d omega
        }
    }
    vec4 normHeight = normHeight(texCoords / wMirrorSize * wCanvasSize);
    IrradianceHeightOut = vec4(M, max(0.5 + 5000.0 * normHeight.w, 0.0), 0, 1);  // ([W/m^2], [m])
    NormalOut = normHeight.xyz;
}