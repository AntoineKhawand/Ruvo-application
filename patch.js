const fs = require('fs');
let text = fs.readFileSync('c:/ruvo-application/src/screens/CommunityScreen.js', 'utf8');
let lines = text.split(/\r?\n/);

// Remove the old return block (lines 624 to 662 => index 623 to 661) Length is 39
// Replace with the new return block
const newRenderBlock = `                    {activeTab === 'Feed' && (
                        <FeedTab
                            feedData={feedData}
                            feedScope={feedScope}
                            setFeedScope={setFeedScope}
                            navigation={navigation}
                            onOpenOptions={handleOpenOptions}
                            onOpenComments={handleOpenComments}
                            onCheer={handleCheer}
                            showComments={showComments}
                            setShowComments={setShowComments}
                            realComments={realComments}
                            commentText={commentText}
                            setCommentText={setCommentText}
                            replyTo={replyTo}
                            setReplyTo={setReplyTo}
                            handleSendComment={handleSendComment}
                            showOptions={showOptions}
                            setShowOptions={setShowOptions}
                            selectedPost={selectedPost}
                            handleOptionSelect={handleOptionSelect}
                            user={user}
                        />
                    )}
                    {activeTab === 'Explore' && renderExplore()}
                    {activeTab === 'Leaderboards' && renderLeaderboard()}
                    {activeTab === 'Clubs' && (
                        <ClubsTab
                            clubs={clubs}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            navigation={navigation}
                            handleJoinPress={handleJoinPress}
                            seedClubs={seedClubs}
                        />
                    )}
                    {activeTab === 'Challenges' && (
                        <ChallengesTab
                            challenges={challenges}
                            toggleChallengeJoin={toggleChallengeJoin}
                            handleChallengePress={handleChallengePress}
                            showChallengeModal={showChallengeModal}
                            setShowChallengeModal={setShowChallengeModal}
                            selectedChallenge={selectedChallenge}
                            calculateChallengeProgress={calculateChallengeProgress}
                        />
                    )}`;

lines.splice(623, 39, newRenderBlock);

// Remove old line 382 (index 381) and add new hook and handleCheer
const hookRepl = `    const { unreadCount, addNotification } = useNotifications(); const [showNotifications, setShowNotifications] = useState(false); const [showOptions, setShowOptions] = useState(false); const [selectedPost, setSelectedPost] = useState(null);
    const handleCheer = async (item) => {
        const isLiked = item.likedBy?.includes(user?.uid);
        if (typeof toggleLike === 'function') {
           await toggleLike(item.id);
        } else {
           // Provide fallback if toggleLike is undefined in scope
           console.log("Cheered", item.id);
        }
        if (!isLiked) {
            addNotification({ title: \`You cheered \${item.user}!\`, desc: \`You liked their activity: "\${item.title}"\`, type: 'cheer_up' });
        }
    };`;

lines.splice(381, 1, hookRepl);

// Wait, FeedTab, ClubsTab, ChallengesTab imports! We need to add them!
const imports = `import FeedTab from '../components/community/FeedTab';
import ChallengesTab from '../components/community/ChallengesTab';
import ClubsTab from '../components/community/ClubsTab';`;

// Add imports near top
lines.splice(10, 0, imports);

fs.writeFileSync('c:/ruvo-application/src/screens/CommunityScreen.js', lines.join('\\n'));
console.log('Patched');
