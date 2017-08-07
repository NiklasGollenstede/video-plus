
# Video Plus — more video space

So you want to watch that wide screen video on the entire surface of your 21:9 screen? No such luck if the uploader of the video for some reason decided to add black padding bars, which are not noticed on 16:9 screens. On a wider screen, you are stuck with black bars on all 4 sides of the video. For example a 21:9 video padded to 16:9 on a 21:9 screen wastes mode than 40% of the screen on black bars — and this is very common for example for music videos on YouTube or older movies.

This extension changes that. While a video is played, it keeps scanning it for padding bars and zooms the video to crop of the edges as far as it is possible without stretching it or pushing content out to the sides. All black bars are effectively removed.


## Technical note:

To do its magic, this extension needs to know the actual dimensions of the video without padding, and the maximum area the video can cover without colliding with other page element. Both can change without explicit notice, and for the former there isn't even a direct way to get it. It is therefore prudent to calculate and update these values efficiently:

- The original video dimensions are read from video frames: Along all four edges, first the minimal and maximal color values are measured. If they are close enough to each other, the video is probed at three points to test how far the average edge-color holds. The minimum of these probes is considered to be the padding along that edge that could be cropped off.
- For scenes unfortunately the above test above tends to include a bit of actual video content that just happens to be black in the padding. To prevent cropping that off in following brighter scenes, the video needs to re-scanned periodically wile it is playing. This is done every 0.3 to 2.5 seconds, depending on the previous rate of changes in this regard.
- To prevent stuttering due to frequently changing video zoom levels and positions, a delay of 5 seconds (configurable) is added before fully updating the positioning.
- In addition to that, the screen area that is available for the video may change. This is re-evaluated after a number of user - page interactions.


## Permissions used:

- "Access your data for all websites" and "Access browser activity during navigation": This extension can be configured (see its options page) to work on every website, so it needs to know when they are loaded and be allowed to access them. It only does that for the pages you chose (youtube.com by default) and will never send data anywhere.
- "Display notifications to you": Tell you when something goes wrong, so you should never see this ...
