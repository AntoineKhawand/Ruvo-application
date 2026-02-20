const fs = require('fs');
const file = 'c:/ruvo-application/src/screens/CommunityScreen.js';
let content = fs.readFileSync(file, 'utf8');
let lines = content.split(/\r?\n/);

// 1. replace block 884, length 47
const returnReplacement = [
    "                    {activeTab === 'Feed' && (",
    "                        <FeedTab",
    "                            feedData={feedData}",
    "                            feedScope={feedScope}",
    "                            setFeedScope={setFeedScope}",
    "                            navigation={navigation}",
    "                            onOpenOptions={handleOpenOptions}",
    "                            onOpenComments={handleOpenComments}",
    "                            onCheer={handleCheer}",
    "                            showComments={showComments}",
    "                            setShowComments={setShowComments}",
    "                            realComments={realComments}",
    "                            commentText={commentText}",
    "                            setCommentText={setCommentText}",
    "                            replyTo={replyTo}",
    "                            setReplyTo={setReplyTo}",
    "                            handleSendComment={handleSendComment}",
    "                            showOptions={showOptions}",
    "                            setShowOptions={setShowOptions}",
    "                            selectedPost={selectedPost}",
    "                            handleOptionSelect={handleOptionSelect}",
    "                            user={userData}",
    "                        />",
    "                    )}",
    "                    {activeTab === 'Explore' && renderExplore()}",
    "                    {activeTab === 'Leaderboards' && renderLeaderboard()}",
    "                    {activeTab === 'Clubs' && (",
    "                        <ClubsTab",
    "                            clubs={clubs}",
    "                            searchQuery={searchQuery}",
    "                            setSearchQuery={setSearchQuery}",
    "                            navigation={navigation}",
    "                            handleJoinPress={handleJoinPress}",
    "                            seedClubs={seedClubs}",
    "                        />",
    "                    )}",
    "                    {activeTab === 'Challenges' && (",
    "                        <ChallengesTab",
    "                            challenges={challenges}",
    "                            toggleChallengeJoin={toggleChallengeJoin}",
    "                            handleChallengePress={handleChallengePress}",
    "                            showChallengeModal={showChallengeModal}",
    "                            setShowChallengeModal={setShowChallengeModal}",
    "                            selectedChallenge={selectedChallenge}",
    "                            calculateChallengeProgress={calculateChallengeProgress}",
    "                        />",
    "                    )}"
];
lines.splice(884, 47, ...returnReplacement);

// 2. delete renderChallenges
lines.splice(722, 81);

// 3. delete renderClubs
lines.splice(655, 32);

// 4. replace handleDateFilterClick & useNotifications
const hookAndCheer = [
    "    const handleDateFilterClick = () => { if (activeTime === 'All-Time') { Alert.alert(\"Filter by Date\", \"Select a time range:\", [{ text: \"Today\", onPress: () => { setDateLabel(getTodayDate()); setDateFilterType('Day'); } }, { text: \"This Month\", onPress: () => { setDateLabel(getMonthDate()); setDateFilterType('Month'); } }, { text: \"This Year\", onPress: () => { setDateLabel(getYearDate()); setDateFilterType('Year'); } }, { text: \"Cancel\", style: \"cancel\" }]); } };",
    "    const { unreadCount, addNotification } = useNotifications(); const [showNotifications, setShowNotifications] = useState(false); const [showOptions, setShowOptions] = useState(false); const [selectedPost, setSelectedPost] = useState(null);",
    "    const handleCheer = async (item) => { const isLiked = item.likedBy && typeof item.likedBy.includes === 'function' ? item.likedBy.includes(userData?.uid || user?.uid) : false; if (typeof toggleLike === 'function') await toggleLike(item.id); if (!isLiked && typeof addNotification === 'function') { addNotification({ title: `You cheered ${item.user}!`, desc: `You liked their activity: \"${item.title}\"`, type: 'cheer_up' }); } };",
    "    const handleOpenOptions = (post) => { setSelectedPost(post); setShowOptions(true); };",
    "    const handleOptionSelect = async (action) => { setShowOptions(false); if (!selectedPost) return; if (action === 'Share') { try { await Share.share({ message: `Check out this run on Ruvo!` }); } catch (error) { } } else if (action === 'Mute') { setMutedUsers(prev => [...prev, selectedPost.user]); Alert.alert(\"Muted\", `Muted ${selectedPost.user}.`); } else if (action === 'Report') { Alert.alert(\"Reported\", \"Received.\"); } };"
];
lines.splice(530, 4, ...hookAndCheer);

// 5. delete FeedScopeToggle
lines.splice(228, 77);

// 6. delete extracts (FeedCard, BADGE_ICONS, etc)
lines.splice(115, 71);

// 7. add imports
const importsCode = [
    "import FeedTab from '../components/community/FeedTab';",
    "import ChallengesTab from '../components/community/ChallengesTab';",
    "import ClubsTab from '../components/community/ClubsTab';"
];
lines.splice(8, 0, ...importsCode);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Refactoring cleanly applied with real arrays!');
