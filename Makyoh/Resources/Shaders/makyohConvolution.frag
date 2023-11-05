#version 420 core
out vec4 FilteredOut;

in vec2 texCoords;
in vec4 w_rayDir;

layout (binding = 0) uniform sampler2D rawNormalHeight;

void main()
{
    vec4 filtered = vec4(0, 0, 0, 0);
    vec2 size = textureSize(rawNormalHeight, 0);
    int n = 100;
    int count = 0;
    for (int x = -n / 2; x < n / 2; x++) {
        for (int y = -n / 2; y < n / 2; y++) {
            filtered += texture(rawNormalHeight, texCoords + vec2(x, y) / size);
            count++;
        }
    }
    filtered.xyz = normalize(filtered.xyz);
    filtered.w /= float(count);
    FilteredOut = filtered;
    //FilteredOut = texture(rawNormalHeight, texCoords);
}